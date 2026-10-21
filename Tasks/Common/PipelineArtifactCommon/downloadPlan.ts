import { isValidArtifactName, validateArtifactName } from "./artifactName";
import { BuildArtifact, BuildResult, PipelineBuildService } from "./buildService";
import { TaskInputs, ToolPlan, emptyPlan } from "./inputs";
import { resolveTaskPath } from "./publishPlan";

export const BuildNumberVariable = "BuildNumber";
export const ResourceTypesVariable = "DownloadPipelineArtifactResourceTypes";
export const FileShareDownloadWarning =
    "Please use Download Build Artifact task for downloading UNC type artifact. https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/utility/download-build-artifacts?view=azure-devops";

const ContainerType = "Container";
const PipelineArtifactType = "PipelineArtifact";
const FileShareType = "filepath";
const KnownTypes = [ContainerType, PipelineArtifactType, FileShareType];
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

/** The known resource type of an artifact, or undefined for types the task cannot download. */
export function knownType(artifact: BuildArtifact): string | undefined {
    return KnownTypes.find(type => equalsIgnoreCase(type, artifact.resource?.type));
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

/**
 * Lists the artifacts the download covers and derives the resource types output, as the agent plug-in did:
 * known types in Container, PipelineArtifact, file share order; all artifacts use the type name, a single
 * artifact reports its own resource type.
 */
export async function selectArtifacts(
    service: PipelineBuildService, run: SelectedRun, artifactName: string): Promise<{ resourceTypes: string; hasFileShares: boolean }> {
    let artifacts: BuildArtifact[];
    if (artifactName) {
        const artifact = await service.getArtifact(run.projectId, run.runId, artifactName);
        if (!artifact) {
            throw new Error(`Artifact ${artifactName} was not found for build ${run.runId}.`);
        }
        validateArtifactName(artifact.name ?? "");
        if (!knownType(artifact)) {
            throw new Error(`Artifact '${artifactName}' has unsupported resource type '${artifact.resource?.type ?? ""}'. No transfer was started.`);
        }
        artifacts = [artifact];
    } else {
        artifacts = (await service.getArtifacts(run.projectId, run.runId)).filter(artifact => isValidArtifactName(artifact.name) && knownType(artifact));
    }

    const resourceTypes = KnownTypes
        .filter(type => artifacts.some(artifact => knownType(artifact) === type))
        .map(type => artifactName ? artifacts[0].resource?.type ?? type : type);
    return { resourceTypes: resourceTypes.join(","), hasFileShares: artifacts.some(artifact => knownType(artifact) === FileShareType) };
}

/**
 * The agent setting that makes build container downloads use the file container service instead of BlobStore.
 */
export const DisableBuildArtifactsToBlobVariable = "DISABLE_BUILD_ARTIFACTS_TO_BLOB";

/**
 * Reads a boolean agent setting the way the agent does: "1", "true", and "$true" (any case) are true.
 */
export function isAgentKnobTrue(value: string | undefined): boolean {
    return ["1", "true", "$true"].includes((value ?? "").toLowerCase());
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
    if (isAgentKnobTrue(task.variable(DisableBuildArtifactsToBlobVariable))) {
        plan.args.push("--disable-build-artifacts-to-blob");
    }
    if (selection.hasFileShares) {
        plan.warnings.push(FileShareDownloadWarning);
    }
    plan.variablesOnSuccess[ResourceTypesVariable] = selection.resourceTypes;
    return plan;
}
