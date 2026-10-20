import * as path from "node:path";
import { normalizeJobIdentifier, validateArtifactName } from "./artifactName";
import { TaskInputs, ToolPlan, emptyPlan } from "./inputs";

export interface PublishEnvironment {
    platform: NodeJS.Platform;
    exists(file: string): boolean;
}

const ParallelCountWarning = "The parallel count must be at least 1 and not greater than 128; using the nearest allowed value.";

/** Resolves a task path input against System.DefaultWorkingDirectory, as the agent plug-ins did. */
export function resolveTaskPath(task: TaskInputs, value: string): string {
    return path.resolve(task.variable("System.DefaultWorkingDirectory") ?? process.cwd(), value);
}

/** Parses the file share parallel count and clamps it to 1-128, as PublishPipelineArtifact@1 did. */
export function parseParallelCount(value: string, warnings: string[]): number {
    const count = Number(value);
    if (!value.trim() || !Number.isInteger(count)) {
        throw new Error("The parallel count must be a number.");
    }
    if (count < 1 || count > 128) {
        warnings.push(ParallelCountWarning);
        return Math.min(128, Math.max(1, count));
    }
    return count;
}

/**
 * Processes PublishPipelineArtifact inputs: the artifact type, default name, name validation, host type,
 * source path, and file share options. ArtifactTool then performs the upload or copy.
 */
export function preparePublish(task: TaskInputs, environment: PublishEnvironment): ToolPlan {
    const artifactType = (task.input("artifactType") || "pipeline").toLowerCase();
    if (artifactType !== "pipeline" && artifactType !== "filepath") {
        throw new Error(`Artifact type '${task.input("artifactType")}' is not recognized.`);
    }

    const requestedName = task.input("artifactName");
    const artifactName = requestedName.trim() ? requestedName : normalizeJobIdentifier(task.variable("System.JobIdentifier"));
    validateArtifactName(artifactName);

    const hostType = task.variable("System.HostType");
    if (artifactType === "pipeline" && hostType && hostType.toLowerCase() !== "build") {
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
        "--artifact-name", artifactName,
        "--artifact-type", artifactType
    ]);

    const properties = task.input("properties");
    if (properties.trim()) {
        plan.args.push("--properties", properties);
    }

    const jobId = task.variable("System.JobId");
    if (jobId) {
        plan.args.push("--job-id", jobId);
    }

    if (artifactType === "filepath") {
        if (environment.platform !== "win32") {
            throw new Error("Publishing to a file share is supported only on Windows.");
        }
        plan.args.push("--file-share-path", task.input("fileSharePath", true));
        if (task.boolInput("parallel")) {
            plan.args.push("--parallel-count", String(parseParallelCount(task.input("parallelCount") || "8", plan.warnings)));
        }
    }

    return plan;
}
