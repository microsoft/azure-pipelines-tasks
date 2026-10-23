import { chunkHashTypeArgs, dedupParallelismEnvironment } from "./agentKnobs";
import { invalidArtifactNameMessage, isValidArtifactName, validateArtifactName } from "./artifactName";
import { BuildArtifact, BuildResult, PipelineBuildService } from "./buildService";
import { TaskInputs, ToolPlan, emptyPlan } from "./inputs";
import { resolveTaskPath } from "./publishPlan";

export const BuildNumberVariable = "BuildNumber";
export const ResourceTypesVariable = "DownloadPipelineArtifactResourceTypes";
export const BuildArtifactsTaskHint = "Use the Download build artifacts task (DownloadBuildArtifacts@1) for build container and file share artifacts.";

const PipelineArtifactType = "PipelineArtifact";
/** Artifact types the previous major downloaded and this one does not. */
const BuildArtifactTypes = ["Container", "filepath"];
const GuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SelectedRun {
    projectId: string;
    runId: number;
}

function equalsIgnoreCase(a: string | undefined, b: string | undefined): boolean {
    return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

function parseRunId(value: string | undefined, describe: (value: string) => string): number {
    if (!value || !/^[1-9][0-9]*$/.test(value.trim())) {
        throw new Error(describe(value ?? ""));
    }
    return parseInt(value.trim(), 10);
}

function isPipelineArtifact(artifact: BuildArtifact): boolean {
    return equalsIgnoreCase(artifact.resource?.type, PipelineArtifactType);
}

/** Selects the project and run to download from, matching DownloadPipelineArtifact@2. */
export async function resolveRun(task: TaskInputs, service: PipelineBuildService, log: (message: string) => void): Promise<SelectedRun> {
    const source = task.input("source", true);
    const hostType = task.variable("System.HostType");

    if (equalsIgnoreCase(source, "current")) {
        const projectId = task.variable("System.TeamProjectId");
        if (!projectId || !GuidPattern.test(projectId)) {
            throw new Error("The current run's project ID (System.TeamProjectId) is not available.");
        }

        const buildId = task.variable("Build.BuildId");
        if (!buildId || !/^[1-9][0-9]*$/.test(buildId)) {
            if (equalsIgnoreCase(hostType, "Release") || equalsIgnoreCase(hostType, "DeploymentGroup")) {
                throw new Error(`The current run's build ID is not available in a ${hostType} job. Download from a specific run instead.`);
            }
            throw new Error(`Artifacts cannot be downloaded from the current run in a '${hostType ?? ""}' job.`);
        }

        return { projectId, runId: parseInt(buildId, 10) };
    }

    if (!equalsIgnoreCase(source, "specific")) {
        throw new Error(`Artifact source '${source}' is not recognized.`);
    }

    const project = task.input("project", true);
    const projectId = GuidPattern.test(project) ? project : await service.getProjectId(project);
    if (!projectId) {
        throw new Error(`Get project failed for project: ${project}`);
    }

    const definition = task.input("pipeline");
    if (task.boolInput("preferTriggeringPipeline") && definition) {
        const prefix = hostType && !equalsIgnoreCase(hostType, "build")
            ? `Release.Artifacts.${task.variable("Release.TriggeringArtifact.Alias") ?? ""}`
            : "Build.TriggeredBy";
        const triggeringDefinition = task.variable(`${prefix}.DefinitionId`);
        const triggeringRun = task.variable(`${prefix}.BuildId`);
        if (triggeringDefinition && triggeringRun && equalsIgnoreCase(triggeringDefinition, definition)) {
            const runId = parseRunId(triggeringRun, value => `Triggering run ID '${value}' is not valid.`);
            log(`Using triggering run ${runId}.`);
            return { projectId, runId };
        }
    }

    const runVersion = task.input("runVersion", true);
    if (equalsIgnoreCase(runVersion, "specific")) {
        return { projectId, runId: parseRunId(task.input("runId", true), value => `Run ID '${value}' is not valid.`) };
    }

    const latestFromBranch = equalsIgnoreCase(runVersion, "latestFromBranch");
    if (!latestFromBranch && !equalsIgnoreCase(runVersion, "latest")) {
        throw new Error(`Run version '${runVersion}' is not recognized.`);
    }
    if (!definition) {
        throw new Error("A pipeline definition is required to select the latest run.");
    }
    const branch = task.input("runBranch");
    if (latestFromBranch && !branch) {
        throw new Error("A branch is required to select the latest run from a branch.");
    }

    const definitionId = /^[0-9]+$/.test(definition) ? parseInt(definition, 10) : await service.getDefinitionId(projectId, definition);
    if (definitionId === undefined) {
        throw new Error(`Pipeline '${definition}' does not exist.`);
    }

    let resultFilter = BuildResult.Succeeded;
    if (task.boolInput("allowPartiallySucceededBuilds")) {
        resultFilter |= BuildResult.PartiallySucceeded;
    }
    if (task.boolInput("allowFailedBuilds")) {
        resultFilter |= BuildResult.Failed;
    }
    if (task.boolInput("allowCanceledBuilds")) {
        resultFilter |= BuildResult.Canceled;
    }

    const tags = task.input("tags").split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
    const runId = await service.getLatestRunId(projectId, definitionId, latestFromBranch ? branch : undefined, tags, resultFilter);
    if (runId === undefined) {
        throw new Error("No runs of the pipeline match the selected branch, tags, and result filters.");
    }
    return { projectId, runId };
}

export interface ArtifactSelection {
    /** The DownloadPipelineArtifactResourceTypes output. */
    resourceTypes: string;
    hasPipelineArtifacts: boolean;
    /** Build container and file share artifacts a multi-artifact download skips. */
    skipped: BuildArtifact[];
    /** Names of artifacts a multi-artifact download skips because the names are not valid. */
    invalidNames: string[];
}

/**
 * Lists the pipeline artifacts the download covers and derives the resource types output, as the agent plug-in did
 * for pipeline artifacts: a single artifact reports its own resource type. Other artifact types are not downloaded.
 */
export async function selectArtifacts(service: PipelineBuildService, run: SelectedRun, artifactName: string): Promise<ArtifactSelection> {
    if (artifactName) {
        const artifact = await service.getArtifact(run.projectId, run.runId, artifactName);
        if (!artifact) {
            throw new Error(`Artifact ${artifactName} was not found for build ${run.runId}.`);
        }
        validateArtifactName(artifact.name ?? "");
        if (!isPipelineArtifact(artifact)) {
            throw new Error(`Artifact '${artifactName}' has resource type '${artifact.resource?.type ?? ""}', and only pipeline artifacts can be downloaded. ` +
                `No transfer was started. ${BuildArtifactsTaskHint}`);
        }
        return { resourceTypes: artifact.resource?.type ?? PipelineArtifactType, hasPipelineArtifacts: true, skipped: [], invalidNames: [] };
    }

    // As the agent plug-in did with strict name validation, artifacts with names that are not valid are skipped with an error.
    const listed = await service.getArtifacts(run.projectId, run.runId);
    const invalidNames = listed.filter(artifact => !isValidArtifactName(artifact.name)).map(artifact => artifact.name ?? "");
    const all = listed.filter(artifact => isValidArtifactName(artifact.name));
    const artifacts = all.filter(isPipelineArtifact);
    const skipped = all.filter(artifact => BuildArtifactTypes.some(type => equalsIgnoreCase(type, artifact.resource?.type)));
    return { resourceTypes: artifacts.length > 0 ? PipelineArtifactType : "", hasPipelineArtifacts: artifacts.length > 0, skipped, invalidNames };
}
/**
 * Processes DownloadPipelineArtifact inputs: selects the run and artifacts and computes the outputs.
 * ArtifactTool then transfers the selected run's artifacts.
 */
export async function prepareDownload(task: TaskInputs, service: PipelineBuildService, log: (message: string) => void): Promise<ToolPlan> {
    const artifactName = task.input("artifact");
    if (artifactName) {
        validateArtifactName(artifactName);
    }

    const target = resolveTaskPath(task, task.input("path", true));
    const run = await resolveRun(task, service, log);
    const plan = emptyPlan([
        "pipelineartifact", "download",
        "--project", run.projectId,
        "--pipeline-id", String(run.runId),
        "--path", target
    ]);
    plan.variables[BuildNumberVariable] = String(run.runId);

    const selection = await selectArtifacts(service, run, artifactName);
    if (artifactName) {
        plan.args.push("--artifact-name", artifactName);
    }
    for (const pattern of task.input("patterns").split(/\r?\n/)) {
        if (pattern.trim()) {
            plan.args.push("--pattern", pattern);
        }
    }
    if (selection.hasPipelineArtifacts) {
        plan.args.push(...chunkHashTypeArgs(task, log));
    }
    plan.environment = dedupParallelismEnvironment(task);
    plan.errors.push(...selection.invalidNames.map(invalidArtifactNameMessage));
    if (selection.skipped.length > 0) {
        const names = selection.skipped.map(artifact => `'${artifact.name}' (${artifact.resource?.type})`).join(", ");
        plan.warnings.push(`Skipped artifacts that are not pipeline artifacts: ${names}. ${BuildArtifactsTaskHint}`);
    }
    plan.variablesOnSuccess[ResourceTypesVariable] = selection.resourceTypes;
    return plan;
}
