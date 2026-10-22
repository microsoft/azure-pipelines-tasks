import * as path from "node:path";
import { chunkHashTypeArgs, dedupParallelismEnvironment, publishDomainArgs } from "./agentKnobs";
import { normalizeJobIdentifier, validateArtifactName } from "./artifactName";
import { TaskInputs, ToolPlan, emptyPlan } from "./inputs";

export interface PublishEnvironment {
    exists(file: string): boolean;
    log?(message: string): void;
}

/** Resolves a task path input against System.DefaultWorkingDirectory, as the agent plug-ins did. */
export function resolveTaskPath(task: TaskInputs, value: string): string {
    return path.resolve(task.variable("System.DefaultWorkingDirectory") ?? process.cwd(), value);
}

/**
 * Processes PublishPipelineArtifact inputs: the default name, name validation, host type, source path, and the
 * agent's pipeline artifact settings. ArtifactTool then uploads and associates the artifact.
 */
export function preparePublish(task: TaskInputs, environment: PublishEnvironment): ToolPlan {
    const requestedName = task.input("artifactName");
    const artifactName = requestedName.trim() ? requestedName : normalizeJobIdentifier(task.variable("System.JobIdentifier"));
    validateArtifactName(artifactName);

    const hostType = task.variable("System.HostType");
    if (hostType && hostType.toLowerCase() !== "build") {
        throw new Error(`Pipeline artifacts can be published only from build jobs, not '${hostType}' jobs.`);
    }

    const runId = task.variable("Build.BuildId");
    if (!runId || !/^[1-9][0-9]*$/.test(runId)) {
        throw new Error("Artifacts can be published only from a build run; the run ID (Build.BuildId) is not available.");
    }

    const source = resolveTaskPath(task, task.input("path", true));
    if (!environment.exists(source)) {
        throw new Error(`Path does not exist: ${source}`);
    }

    const plan = emptyPlan([
        "pipelineartifact", "publish",
        "--project", task.variable("System.TeamProjectId") ?? "",
        "--pipeline-id", runId,
        "--path", source,
        "--artifact-name", artifactName
    ]);

    const properties = task.input("properties");
    if (properties.trim()) {
        plan.args.push("--properties", properties);
    }

    const jobId = task.variable("System.JobId");
    if (jobId) {
        plan.args.push("--job-id", jobId);
    }

    plan.args.push(...publishDomainArgs(task), ...chunkHashTypeArgs(task, message => environment.log?.(message)));
    plan.environment = dedupParallelismEnvironment(task);
    return plan;
}