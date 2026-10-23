import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { BuildArtifact, BuildResult } from "azure-devops-node-api/interfaces/BuildInterfaces";
import { ContainerItemStatus, ContainerItemType, FileContainerItem } from "azure-devops-node-api/interfaces/FileContainerInterfaces";
import { ArtifactService, ArtifactTool, TaskRuntime, downloadArtifacts, resolveRun, triggeringRun, patternsFromInput, executeProcess } from "pipeline-artifact-dev-common";

describe("DownloadPipelineArtifactDevV2 L0", function () {
    this.timeout(10000);
    let root: string;
    let values: Record<string, string>;
    let variables: Record<string, string>;
    let runtime: TaskRuntime;
    let service: ArtifactService;
    let tool: ArtifactTool;
    let calls: string[][];
    let artifacts: BuildArtifact[];
    let outputs: string[];

    const artifact = (name: string, type = "PipelineArtifact", data = "manifest"): BuildArtifact =>
        ({ name, resource: { type, data } });
    const containerItem = (item: string): FileContainerItem =>
        ({ containerId: 123, path: item, itemType: ContainerItemType.File, status: ContainerItemStatus.Created });

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "artifact-download-test-"));
        values = { source: "current", path: path.join(root, "destination"), patterns: "**" };
        variables = {
            "System.ServerType": "Hosted", "System.HostType": "Build", "System.TeamProjectId": "project",
            "Build.BuildId": "42", "System.DefaultWorkingDirectory": root
        };
        outputs = [];
        runtime = {
            input: (name, required) => {
                const value = values[name] ?? "";
                if (required && !value) { throw new Error(`Missing input ${name}`); }
                return value;
            },
            variable: name => variables[name],
            setVariable: (name, value) => { variables[name] = value; },
            warning: message => { outputs.push(message); },
            output: message => { outputs.push(message); }
        };
        const unexpected = async (): Promise<never> => { throw new Error("Unexpected service call"); };
        artifacts = [artifact("drop")];
        service = {
            projectId: async project => { assert.equal(project, "project-name"); return "project"; },
            definitionId: async () => 10,
            latestRun: async () => 100,
            artifacts: async (project, runId, name) => {
                assert.equal(project, "project");
                assert.equal(runId, 42);
                return name ? artifacts.filter(item => item.name === name) : artifacts;
            },
            associate: unexpected, containerItems: unexpected, containerFile: unexpected
        };
        calls = [];
        tool = { run: async args => { calls.push(args); }, copy: unexpected };
    });

    afterEach(async () => {
        await fs.rm(root, { recursive: true });
    });

    it("downloads current run and preserves BuildNumber as build ID", async () => {
        values.artifact = "drop";
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(variables.BuildNumber, "42");
        assert.equal(variables.DownloadPipelineArtifactResourceTypes, "PipelineArtifact");
        assert.deepEqual(calls[0], ["pipelineartifact", "download", "--project", "project", "--pipeline-id", "42",
            "--path", values.path, "--artifact-name", "drop", "--pattern", "**"]);
    });

    it("passes multi-download patterns including CRLF without shell parsing", async () => {
        values.patterns = "drop/**/*.dll\r\n!drop/tests/**\r\n";
        artifacts.push(artifact("symbols"));
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(calls[0].includes("--artifact-name"), false);
        assert.deepEqual(calls[0].slice(-4), ["--pattern", "drop/**/*.dll", "--pattern", "!drop/tests/**"]);
    });

    it("defaults an empty pattern field to **", () => {
        assert.deepEqual(patternsFromInput(""), ["**"]);
    });

    it("resolves relative destinations against the default working directory", async () => {
        values.path = "relative";
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(calls[0][calls[0].indexOf("--path") + 1], path.join(root, "relative"));
    });

    it("selects a specific run without a pipeline definition lookup", async () => {
        values = { ...values, source: "specific", project: "project-name", runVersion: "specific", runId: "123" };
        service.definitionId = async () => { throw new Error("must not look up definition"); };
        assert.deepEqual(await resolveRun(runtime, service), { project: "project", runId: 123 });
    });

    it("selects latest by branch, tags and all allowed result filters", async () => {
        values = { ...values, source: "specific", project: "project-name", pipeline: "pipeline-name",
            runVersion: "latestFromBranch", runBranch: "refs/heads/main", tags: "one,two",
            allowPartiallySucceededBuilds: "true", allowFailedBuilds: "true", allowCanceledBuilds: "true" };
        service.latestRun = async (project, query) => {
            assert.equal(project, "project");
            assert.deepEqual(query, {
                definition: 10, tags: ["one", "two"], branch: "refs/heads/main",
                results: BuildResult.Succeeded | BuildResult.PartiallySucceeded | BuildResult.Failed | BuildResult.Canceled
            });
            return 100;
        };
        assert.equal((await resolveRun(runtime, service)).runId, 100);
    });

    it("prefers a matching release-triggered build", async () => {
        values = { ...values, source: "specific", project: "project-name", pipeline: "10", preferTriggeringPipeline: "true" };
        variables["System.HostType"] = "Release";
        variables["Release.TriggeringArtifact.Alias"] = "drop";
        variables["Release.Artifacts.drop.DefinitionId"] = "10";
        variables["Release.Artifacts.drop.BuildId"] = "123";
        assert.equal((await resolveRun(runtime, service)).runId, 123);
    });

    it("prefers a matching build-triggered run", () => {
        variables["Build.TriggeredBy.DefinitionId"] = "10";
        variables["Build.TriggeredBy.BuildId"] = "123";
        assert.equal(triggeringRun(runtime, "10"), 123);
        assert.equal(triggeringRun(runtime, "11"), undefined);
    });

    it("falls back to configured selection when the release alias is absent", async () => {
        values = { ...values, source: "specific", project: "project-name", pipeline: "10",
            preferTriggeringPipeline: "true", runVersion: "specific", runId: "456" };
        variables["System.HostType"] = "Release";
        assert.equal((await resolveRun(runtime, service)).runId, 456);
    });

    it("fails instead of selecting a different build when a triggering ID is malformed", () => {
        variables["Build.TriggeredBy.DefinitionId"] = "10";
        variables["Build.TriggeredBy.BuildId"] = "123bad";
        assert.throws(() => triggeringRun(runtime, "10"), /positive 32-bit/);
    });

    it("fails explicitly when run lookup returns no build", async () => {
        values = { ...values, source: "specific", project: "project-name", pipeline: "10", runVersion: "latest" };
        service.latestRun = async () => { throw new Error("No matching build"); };
        await assert.rejects(resolveRun(runtime, service), /No matching build/);
    });

    it("preflights every artifact name before any transfer", async () => {
        artifacts.push(artifact("../escape"));
        await assert.rejects(downloadArtifacts(runtime, service, tool, new AbortController().signal), /Invalid artifact name/);
        assert.equal(calls.length, 0);
    });

    it("fails unknown resource types instead of silently skipping them", async () => {
        artifacts.push(artifact("unexpected", "Unknown"));
        await assert.rejects(downloadArtifacts(runtime, service, tool, new AbortController().signal), /Unsupported artifact resource/);
        assert.equal(calls.length, 0);
    });

    it("does not label failed transfers as successfully downloaded", async () => {
        tool.run = async () => { throw new Error("tool failed"); };
        await assert.rejects(downloadArtifacts(runtime, service, tool, new AbortController().signal), /tool failed/);
        assert.equal(variables.DownloadPipelineArtifactResourceTypes, undefined);
        assert.equal(outputs.includes("Artifacts downloaded."), false);
    });

    it("reports an empty run explicitly without invoking artifacttool", async () => {
        artifacts = [];
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(calls.length, 0);
        assert.equal(variables.DownloadPipelineArtifactResourceTypes, "");
        assert.match(outputs[0], /No artifacts/);
    });

    it("downloads selected container files with multi-artifact layout", async () => {
        artifacts = [artifact("drop"), artifact("build", "Container", "#/123/build")];
        values.patterns = "build/**/*.txt";
        service.containerItems = async (id, project, itemRoot) => {
            assert.equal(id, 123);
            assert.equal(project, "project");
            assert.equal(itemRoot, "build");
            return [
                containerItem("build/folder/one.txt"),
                containerItem("build/folder/two.dll")
            ];
        };
        service.containerFile = async (id, project, item) => {
            assert.equal(item, "build/folder/one.txt");
            return Readable.from(["content"]);
        };
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(await fs.readFile(path.join(values.path, "build", "folder", "one.txt"), "utf8"), "content");
        await assert.rejects(fs.stat(path.join(values.path, "build", "folder", "two.dll")), /ENOENT/);
        assert.equal(variables.DownloadPipelineArtifactResourceTypes, "PipelineArtifact,Container");
    });

    it("uses destination root directly for a named container artifact", async () => {
        values.artifact = "build";
        artifacts = [artifact("build", "Container", "#/123/build")];
        service.containerItems = async () => [containerItem("build/one.txt")];
        service.containerFile = async () => Readable.from(["one"]);
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(await fs.readFile(path.join(values.path, "one.txt"), "utf8"), "one");
        assert.equal(calls.length, 0);
    });

    it("rejects traversal in container file metadata before writing", async () => {
        artifacts = [artifact("build", "Container", "#/123/build")];
        service.containerItems = async () => [
            containerItem("build/one.txt"),
            containerItem("build/../../outside")
        ];
        service.containerFile = async () => { throw new Error("must not download"); };
        await assert.rejects(downloadArtifacts(runtime, service, tool, new AbortController().signal), /unsafe destination/);
        await assert.rejects(fs.stat(path.join(values.path, "build", "one.txt")), /ENOENT/);
    });

    it("cleans partial container files on a failed stream", async () => {
        artifacts = [artifact("build", "Container", "#/123/build")];
        service.containerItems = async () => [containerItem("build/one.txt")];
        service.containerFile = async () => new Readable({ read() { this.destroy(new Error("stream failure")); } });
        await assert.rejects(downloadArtifacts(runtime, service, tool, new AbortController().signal), /stream failure/);
        assert.deepEqual(await fs.readdir(path.join(values.path, "build")), []);
    });

    it("downloads Windows file-share artifacts using artifact-prefixed patterns and layout", async function () {
        if (process.platform !== "win32") { this.skip(); }
        const share = path.join(root, "share");
        await fs.mkdir(path.join(share, "files"), { recursive: true });
        await fs.writeFile(path.join(share, "files", "one.txt"), "one");
        await fs.writeFile(path.join(share, "files", "two.dll"), "two");
        artifacts = [artifact("files", "filepath", share)];
        values.artifact = "files";
        values.patterns = "files/**/*.txt";
        await downloadArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(await fs.readFile(path.join(values.path, "files", "one.txt"), "utf8"), "one");
        await assert.rejects(fs.stat(path.join(values.path, "files", "two.dll")), /ENOENT/);
        assert.equal(variables.DownloadPipelineArtifactResourceTypes, "filepath");
    });

    it("never starts artifacttool for a cancelled download", async () => {
        const controller = new AbortController();
        controller.abort();
        await assert.rejects(downloadArtifacts(runtime, service, tool, controller.signal));
        assert.equal(calls.length, 0);
    });

    it("loads the packaged download entry point and fails an invalid source", async () => {
        const manifest = JSON.parse(await fs.readFile(path.join(__dirname, "..", "task.json"), "utf8"));
        assert.equal(manifest.preview, true);
        assert.notEqual(manifest.id.toLowerCase(), "61f2a582-95ae-4948-b34d-a1b3c4f6a737");
        assert.deepEqual(Object.keys(manifest.execution), ["Node24"]);
        const lines: string[] = [];
        const code = await executeProcess(process.execPath, [path.join(__dirname, "..", "download.js")], {
            ...process.env,
            INPUT_ARTIFACTTOOLPATH: process.execPath, INPUT_PATH: values.path,
            INPUT_SOURCE: "unexpected",
            SYSTEM_SERVERTYPE: "Hosted",
            ENDPOINT_URL_SYSTEMVSSCONNECTION: "https://dev.azure.com/test",
            ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN: "test-token-not-a-secret"
        }, new AbortController().signal, line => { lines.push(line); });
        assert.equal(code, 0);
        assert.match(lines.join("\n"), /task.complete result=Failed/);
        assert.match(lines.join("\n"), /Unrecognized artifact source/);
        assert.doesNotMatch(lines.join("\n"), /result=Succeeded/);
    });
});
