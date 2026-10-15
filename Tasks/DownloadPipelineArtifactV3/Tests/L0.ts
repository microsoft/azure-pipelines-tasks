import * as assert from "assert";
import { TaskInputs, downloadArguments } from "pipeline-artifact-common";

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

describe("DownloadPipelineArtifact L0 Suite", function () {
    const buildVariables = { "System.TeamProjectId": "project-id", "Build.BuildId": "42", "System.HostType": "build" };

    it("downloads from the current run using job variables", () => {
        const args = downloadArguments(inputs({ source: "current", artifact: "drop", patterns: "**", path: "out" }, buildVariables));

        assert.deepStrictEqual(args.slice(0, 2), ["pipelineartifact", "download"]);
        assert.strictEqual(optionValue(args, "--source"), "current");
        assert.strictEqual(optionValue(args, "--project"), "project-id");
        assert.strictEqual(optionValue(args, "--pipeline-id"), "42");
        assert.strictEqual(optionValue(args, "--artifact-name"), "drop");
        assert.strictEqual(optionValue(args, "--path"), "out");
        assert.strictEqual(args.indexOf("--run-version"), -1);
    });

    it("omits the artifact name for multi-artifact downloads", () => {
        const args = downloadArguments(inputs({ source: "current", path: "out" }, buildVariables));

        assert.strictEqual(args.indexOf("--artifact-name"), -1);
    });

    it("passes each non-empty pattern line in order", () => {
        const args = downloadArguments(inputs({ source: "current", patterns: "**\r\n\n!sub/**\n  ", path: "out" }, buildVariables));

        assert.deepStrictEqual(optionValues(args, "--pattern"), ["**", "!sub/**"]);
    });

    it("maps a specific run", () => {
        const args = downloadArguments(inputs({ source: "specific", project: "Other", pipeline: "12", runVersion: "specific", runId: "99", path: "out" }, buildVariables));

        assert.strictEqual(optionValue(args, "--project"), "Other");
        assert.strictEqual(optionValue(args, "--pipeline-definition"), "12");
        assert.strictEqual(optionValue(args, "--run-version"), "specific");
        assert.strictEqual(optionValue(args, "--pipeline-id"), "99");
        assert.strictEqual(args.indexOf("--branch"), -1);
    });

    it("maps latest from branch with tags and result filters", () => {
        const args = downloadArguments(inputs({
            source: "specific", project: "Other", pipeline: "Build CI", runVersion: "latestFromBranch", runBranch: "refs/heads/main",
            tags: "a,b", allowPartiallySucceededBuilds: "true", allowFailedBuilds: "true", path: "out"
        }, buildVariables));

        assert.strictEqual(optionValue(args, "--branch"), "refs/heads/main");
        assert.strictEqual(optionValue(args, "--tags"), "a,b");
        assert.ok(args.includes("--allow-partially-succeeded"));
        assert.ok(args.includes("--allow-failed"));
        assert.ok(!args.includes("--allow-canceled"));
        assert.strictEqual(args.indexOf("--pipeline-id"), -1);
    });

    it("passes the triggering build for build jobs", () => {
        const args = downloadArguments(inputs({ source: "specific", project: "Other", pipeline: "12", runVersion: "latest", preferTriggeringPipeline: "true", path: "out" },
            { ...buildVariables, "Build.TriggeredBy.DefinitionId": "12", "Build.TriggeredBy.BuildId": "77" }));

        assert.ok(args.includes("--prefer-triggering-pipeline"));
        assert.strictEqual(optionValue(args, "--triggering-definition-id"), "12");
        assert.strictEqual(optionValue(args, "--triggering-run-id"), "77");
    });

    it("passes the triggering artifact for release jobs", () => {
        const args = downloadArguments(inputs({ source: "specific", project: "Other", pipeline: "12", runVersion: "latest", preferTriggeringPipeline: "true", path: "out" }, {
            "System.HostType": "release",
            "Release.TriggeringArtifact.Alias": "_ci",
            "Release.Artifacts._ci.DefinitionId": "12",
            "Release.Artifacts._ci.BuildId": "88"
        }));

        assert.strictEqual(optionValue(args, "--host-type"), "release");
        assert.strictEqual(optionValue(args, "--triggering-definition-id"), "12");
        assert.strictEqual(optionValue(args, "--triggering-run-id"), "88");
    });

    it("requires the run ID for a specific version", () => {
        assert.throws(() => downloadArguments(inputs({ source: "specific", project: "Other", pipeline: "12", runVersion: "specific", path: "out" }, buildVariables)), /runId/);
    });
});
