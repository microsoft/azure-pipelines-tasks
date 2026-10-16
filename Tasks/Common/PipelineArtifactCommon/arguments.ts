/** Reads task inputs and pipeline variables. Implemented with task-lib at run time and by fakes in tests. */
export interface TaskInputs {
    input(name: string, required?: boolean): string;
    boolInput(name: string): boolean;
    variable(name: string): string | undefined;
}

function push(args: string[], option: string, value: string | undefined): void {
    if (value) {
        args.push(option, value);
    }
}

/**
 * Maps PublishPipelineArtifact inputs and pipeline variables to ArtifactTool arguments. Validation and
 * defaults are applied by ArtifactTool, not here.
 */
export function publishArguments(task: TaskInputs): string[] {
    const args = ["pipelineartifact", "publish"];
    push(args, "--project", task.variable("System.TeamProjectId"));
    push(args, "--pipeline-id", task.variable("Build.BuildId"));
    args.push("--path", task.input("path", true));
    push(args, "--artifact-name", task.input("artifactName"));
    push(args, "--job-identifier", task.variable("System.JobIdentifier"));
    push(args, "--job-id", task.variable("System.JobId"));
    push(args, "--host-type", task.variable("System.HostType"));
    push(args, "--properties", task.input("properties"));

    const artifactType = task.input("artifactType") || "pipeline";
    args.push("--artifact-type", artifactType);
    if (artifactType.toLowerCase() === "filepath") {
        args.push("--file-share-path", task.input("fileSharePath", true));
        if (task.boolInput("parallel")) {
            args.push("--parallel-count", task.input("parallelCount") || "8");
        }
    }

    return args;
}

/**
 * Maps DownloadPipelineArtifact inputs and pipeline variables to ArtifactTool arguments. Run selection,
 * validation, and transfers are performed by ArtifactTool.
 */
export function downloadArguments(task: TaskInputs): string[] {
    const args = ["pipelineartifact", "download"];
    const source = task.input("source", true);
    args.push("--source", source);
    push(args, "--host-type", task.variable("System.HostType"));

    if (source === "specific") {
        args.push("--project", task.input("project", true));
        const runVersion = task.input("runVersion", true);
        args.push("--run-version", runVersion);
        push(args, "--pipeline-definition", task.input("pipeline"));
        if (runVersion === "specific") {
            args.push("--pipeline-id", task.input("runId", true));
        }
        if (runVersion === "latestFromBranch") {
            args.push("--branch", task.input("runBranch", true));
        }
        push(args, "--tags", task.input("tags"));
        if (task.boolInput("allowPartiallySucceededBuilds")) {
            args.push("--allow-partially-succeeded");
        }
        if (task.boolInput("allowFailedBuilds")) {
            args.push("--allow-failed");
        }
        if (task.boolInput("allowCanceledBuilds")) {
            args.push("--allow-canceled");
        }
        if (task.boolInput("preferTriggeringPipeline")) {
            args.push("--prefer-triggering-pipeline");
            const hostType = task.variable("System.HostType");
            const prefix = hostType && hostType.toLowerCase() !== "build"
                ? `Release.Artifacts.${task.variable("Release.TriggeringArtifact.Alias") ?? ""}`
                : "Build.TriggeredBy";
            push(args, "--triggering-definition-id", task.variable(`${prefix}.DefinitionId`));
            push(args, "--triggering-run-id", task.variable(`${prefix}.BuildId`));
        }
    } else {
        push(args, "--project", task.variable("System.TeamProjectId"));
        push(args, "--pipeline-id", task.variable("Build.BuildId"));
    }

    push(args, "--artifact-name", task.input("artifact"));
    for (const pattern of task.input("patterns").split(/\r?\n/)) {
        if (pattern.trim()) {
            args.push("--pattern", pattern);
        }
    }
    args.push("--path", task.input("path", true));
    return args;
}
