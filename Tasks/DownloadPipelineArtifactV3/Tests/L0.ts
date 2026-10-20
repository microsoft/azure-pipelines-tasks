import * as assert from "assert";
import * as path from "path";
import {
    BuildArtifact,
    BuildResult,
    FileShareDownloadWarning,
    PipelineBuildService,
    TaskInputs,
    prepareDownload,
    resolveRun
} from "pipeline-artifact-common";

const ProjectId = "6f3b2b8e-3f43-4e4c-9c1e-0c1b6f8f2a11";

function inputs(values: Record<string, string>, variables: Record<string, string> = {}): TaskInputs {
    return {
        input: (name, required) => {
            const value = values[name] ?? "";
            if (required && !value) {
                throw new Error(`Input required: ${name}`);
            }
            return value;
        },
        boolInput: name => (values[name] ?? "").toLowerCase() === "true",
        variable: name => variables[name]
    };
}

function optionValue(args: string[], option: string): string | undefined {
    const index = args.indexOf(option);
    return index >= 0 ? args[index + 1] : undefined;
}

function optionValues(args: string[], option: string): string[] {
    return args.flatMap((arg, index) => arg === option ? [args[index + 1]] : []);
}

function artifact(name: string, type = "PipelineArtifact"): BuildArtifact {
    return { name, resource: { type } } as BuildArtifact;
}

function fakeService(artifacts: BuildArtifact[] = [artifact("drop")]): PipelineBuildService & { calls: string[] } {
    const calls: string[] = [];
    return {
        calls,
        getProjectId: async project => { calls.push(`project ${project}`); return project === "Other" ? ProjectId : undefined; },
        getDefinitionId: async (projectId, name) => { calls.push(`definition ${projectId} ${name}`); return name === "Build CI" ? 7 : undefined; },
        getLatestRunId: async (projectId, definitionId, branch, tags, resultFilter) => {
            calls.push(`latest ${projectId} ${definitionId} ${branch ?? "-"} [${tags.join("|")}] ${resultFilter}`);
            return 99;
        },
        getArtifact: async (projectId, runId, name) => { calls.push(`artifact ${projectId} ${runId} ${name}`); return artifacts.find(a => a.name === name); },
        getArtifacts: async (projectId, runId) => { calls.push(`artifacts ${projectId} ${runId}`); return artifacts; }
    };
}

describe("DownloadPipelineArtifact L0 Suite", function () {
    const buildVariables = {
        "System.TeamProjectId": ProjectId, "Build.BuildId": "42", "System.HostType": "build",
        "System.DefaultWorkingDirectory": path.resolve("work")
    };
    const noLog = () => undefined;

    describe("resolveRun", () => {
        it("uses the current run from job variables", async () => {
            assert.deepStrictEqual(await resolveRun(inputs({ source: "current" }, buildVariables), fakeService(), noLog), { projectId: ProjectId, runId: 42 });
        });

        it("explains why the current run is unavailable in release jobs", async () => {
            await assert.rejects(resolveRun(inputs({ source: "current" }, { ...buildVariables, "Build.BuildId": "", "System.HostType": "Release" }), fakeService(), noLog),
                /build ID is not available in a Release job/);
        });

        it("resolves a project name and a specific run", async () => {
            const service = fakeService();

            const run = await resolveRun(inputs({ source: "specific", project: "Other", runVersion: "specific", runId: "123" }, buildVariables), service, noLog);

            assert.deepStrictEqual(run, { projectId: ProjectId, runId: 123 });
            assert.deepStrictEqual(service.calls, ["project Other"]);
        });

        it("rejects unknown projects and invalid run IDs", async () => {
            await assert.rejects(resolveRun(inputs({ source: "specific", project: "Missing", runVersion: "specific", runId: "1" }), fakeService(), noLog),
                /Get project failed for project: Missing/);
            await assert.rejects(resolveRun(inputs({ source: "specific", project: ProjectId, runVersion: "specific", runId: "x" }), fakeService(), noLog),
                /Run ID 'x' is not valid/);
        });

        it("selects the latest run from a branch with the definition name, tags, and result filters", async () => {
            const service = fakeService();

            const run = await resolveRun(inputs({
                source: "specific", project: ProjectId, pipeline: "Build CI", runVersion: "latestFromBranch", runBranch: "refs/heads/main",
                tags: "a, ,b", allowPartiallySucceededBuilds: "true", allowFailedBuilds: "true"
            }), service, noLog);

            assert.deepStrictEqual(run, { projectId: ProjectId, runId: 99 });
            assert.deepStrictEqual(service.calls, [
                `definition ${ProjectId} Build CI`,
                `latest ${ProjectId} 7 refs/heads/main [a|b] ${BuildResult.Succeeded | BuildResult.PartiallySucceeded | BuildResult.Failed}`
            ]);
        });

        it("requires a definition and a branch for latest selections", async () => {
            await assert.rejects(resolveRun(inputs({ source: "specific", project: ProjectId, runVersion: "latest" }), fakeService(), noLog), /pipeline definition is required/);
            await assert.rejects(resolveRun(inputs({ source: "specific", project: ProjectId, pipeline: "7", runVersion: "latestFromBranch" }), fakeService(), noLog),
                /branch is required/);
            await assert.rejects(resolveRun(inputs({ source: "specific", project: ProjectId, pipeline: "Nope", runVersion: "latest" }), fakeService(), noLog),
                /Pipeline 'Nope' does not exist/);
        });

        it("prefers the triggering build in build jobs", async () => {
            const logs: string[] = [];
            const service = fakeService();

            const run = await resolveRun(inputs({ source: "specific", project: ProjectId, pipeline: "7", runVersion: "latest", preferTriggeringPipeline: "true" },
                { ...buildVariables, "Build.TriggeredBy.DefinitionId": "7", "Build.TriggeredBy.BuildId": "55" }), service, message => logs.push(message));

            assert.deepStrictEqual(run, { projectId: ProjectId, runId: 55 });
            assert.deepStrictEqual(logs, ["Using triggering run 55."]);
            assert.deepStrictEqual(service.calls, []);
        });

        it("prefers the triggering artifact in release jobs", async () => {
            const run = await resolveRun(inputs({ source: "specific", project: ProjectId, pipeline: "7", runVersion: "latest", preferTriggeringPipeline: "true" }, {
                "System.HostType": "release", "Release.TriggeringArtifact.Alias": "ci",
                "Release.Artifacts.ci.DefinitionId": "7", "Release.Artifacts.ci.BuildId": "77"
            }), fakeService(), noLog);

            assert.deepStrictEqual(run, { projectId: ProjectId, runId: 77 });
        });

        it("ignores a triggering build of another definition", async () => {
            const run = await resolveRun(inputs({ source: "specific", project: ProjectId, pipeline: "7", runVersion: "latest", preferTriggeringPipeline: "true" },
                { ...buildVariables, "Build.TriggeredBy.DefinitionId": "8", "Build.TriggeredBy.BuildId": "55" }), fakeService(), noLog);

            assert.deepStrictEqual(run, { projectId: ProjectId, runId: 99 });
        });
    });

    describe("prepareDownload", () => {
        it("downloads one artifact from the current run and reports its run and type", async () => {
            const plan = await prepareDownload(inputs({ source: "current", artifact: "drop", path: "dl", patterns: "**/*.dll\n\n!**/tests/**" }, buildVariables), fakeService(), noLog);

            assert.deepStrictEqual(plan.args, [
                "pipelineartifact", "download", "--project", ProjectId, "--pipeline-id", "42", "--path", path.resolve("work", "dl"),
                "--artifact-name", "drop", "--pattern", "**/*.dll", "--pattern", "!**/tests/**"
            ]);
            assert.deepStrictEqual(plan.variables, { BuildNumber: "42" });
            assert.deepStrictEqual(plan.variablesOnSuccess, { DownloadPipelineArtifactResourceTypes: "PipelineArtifact" });
            assert.deepStrictEqual(plan.warnings, []);
        });

        it("reports known types of all valid artifacts in plug-in order and warns about file shares", async () => {
            const service = fakeService([artifact("share", "FilePath"), artifact("drop"), artifact("bad:name"), artifact("other", "Unknown"), artifact("old", "Container")]);

            const plan = await prepareDownload(inputs({ source: "current", path: "dl" }, buildVariables), service, noLog);

            assert.strictEqual(plan.args.indexOf("--artifact-name"), -1);
            assert.deepStrictEqual(optionValues(plan.args, "--pattern"), []);
            assert.deepStrictEqual(plan.variablesOnSuccess, { DownloadPipelineArtifactResourceTypes: "Container,PipelineArtifact,filepath" });
            assert.deepStrictEqual(plan.warnings, [FileShareDownloadWarning]);
        });

        it("reports a single artifact's own resource type", async () => {
            const plan = await prepareDownload(inputs({ source: "current", artifact: "share", path: "dl" }, buildVariables), fakeService([artifact("share", "FilePath")]), noLog);

            assert.deepStrictEqual(plan.variablesOnSuccess, { DownloadPipelineArtifactResourceTypes: "FilePath" });
        });

        it("fails before any transfer for missing, invalid, or unsupported artifacts", async () => {
            await assert.rejects(prepareDownload(inputs({ source: "current", artifact: "nope", path: "dl" }, buildVariables), fakeService(), noLog),
                /^Error: Artifact nope was not found for build 42\.$/);
            await assert.rejects(prepareDownload(inputs({ source: "current", artifact: "../x", path: "dl" }, buildVariables), fakeService(), noLog),
                /Artifact name is not valid: \.\.\/x/);
            await assert.rejects(prepareDownload(inputs({ source: "current", artifact: "other", path: "dl" }, buildVariables), fakeService([artifact("other", "Unknown")]), noLog),
                /unsupported resource type 'Unknown'/);
        });

        it("selects a specific run in another project", async () => {
            const plan = await prepareDownload(inputs({ source: "specific", project: "Other", runVersion: "specific", runId: "123", artifact: "drop", path: "dl" }, buildVariables),
                fakeService(), noLog);

            assert.strictEqual(optionValue(plan.args, "--project"), ProjectId);
            assert.strictEqual(optionValue(plan.args, "--pipeline-id"), "123");
            assert.deepStrictEqual(plan.variables, { BuildNumber: "123" });
        });
    });
});