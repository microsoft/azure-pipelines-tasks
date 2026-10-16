import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
    ArtifactService, ArtifactTool, TaskRuntime, publishArtifacts, parseProperties,
    positiveId, validateArtifactName, validateExecutable, validateServiceUrl,
    executeProcess, createArtifactTool, safeDestination
} from "pipeline-artifact-dev-common";

describe("PublishPipelineArtifactDevV1 L0", function () {
    this.timeout(15000);
    let root: string;
    let source: string;
    let values: Record<string, string>;
    let variables: Record<string, string>;
    let runtime: TaskRuntime;
    let service: ArtifactService;
    let tool: ArtifactTool;
    let calls: string[][];
    let warnings: string[];

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "artifact-publish-test-"));
        source = path.join(root, "source with spaces");
        await fs.mkdir(source);
        values = { path: source, artifactType: "pipeline", artifactName: "drop" };
        variables = {
            "System.ServerType": "Hosted", "System.HostType": "Build", "System.TeamProjectId": "project",
            "Build.BuildId": "42", "System.JobId": "job", "System.JobIdentifier": "job.default",
            "System.DefaultWorkingDirectory": root, "Agent.TempDirectory": root
        };
        warnings = [];
        runtime = {
            input: (name, required) => {
                const value = values[name] ?? "";
                if (required && !value) { throw new Error(`Missing input ${name}`); }
                return value;
            },
            variable: name => variables[name],
            setVariable: (name, value) => { variables[name] = value; },
            warning: message => { warnings.push(message); },
            output: () => {}
        };
        const unexpected = async (): Promise<never> => { throw new Error("Unexpected service call"); };
        service = {
            projectId: unexpected, definitionId: unexpected, latestRun: unexpected,
            artifacts: unexpected, associate: unexpected, containerItems: unexpected, containerFile: unexpected
        };
        calls = [];
        tool = {
            run: async args => { calls.push(args); },
            copy: unexpected
        };
    });

    afterEach(async () => {
        await fs.rm(root, { recursive: true });
    });

    it("passes pipeline metadata and paths as separate CLI arguments", async () => {
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        assert.deepEqual(calls[0], ["pipelineartifact", "publish", "--project", "project", "--pipeline-id", "42",
            "--artifact-name", "drop", "--path", source, "--job-id", "job"]);
    });

    it("uses the normalized job identifier and working-directory-relative path", async () => {
        values.artifactName = "";
        values.path = path.basename(source);
        variables["System.JobIdentifier"] = "stage/job.default";
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(calls[0][calls[0].indexOf("--artifact-name") + 1], "stagejob");
        assert.equal(calls[0][calls[0].indexOf("--path") + 1], source);
    });

    it("supports a single file", async () => {
        values.path = path.join(root, "one.txt");
        await fs.writeFile(values.path, "one");
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(calls[0][calls[0].indexOf("--path") + 1], values.path);
    });

    it("writes properties to a unique file and cleans up on success", async () => {
        values.properties = '{"user-team":"artifacts"}';
        let file = "";
        tool.run = async args => {
            file = args[args.indexOf("--properties-file") + 1];
            assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), { "user-team": "artifacts" });
        };
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        await assert.rejects(fs.stat(file), /ENOENT/);
    });

    it("cleans up properties on tool failure and propagates failure", async () => {
        values.properties = '{"user-team":"artifacts"}';
        let file = "";
        tool.run = async args => {
            file = args[args.indexOf("--properties-file") + 1];
            throw new Error("transfer failed");
        };
        await assert.rejects(publishArtifacts(runtime, service, tool, new AbortController().signal), /transfer failed/);
        await assert.rejects(fs.stat(file), /ENOENT/);
    });

    it("passes the pipeline domain override", async () => {
        variables.SEND_PIPELINE_ARTIFACTS_TO_BLOBSTORE_DOMAIN = "1";
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(calls[0][calls[0].indexOf("--domain-id") + 1], "1");
    });

    for (const [key, value, expected] of [
        ["System.ServerType", "OnPremises", /not supported/],
        ["System.HostType", "Release", /only from a build/],
        ["Build.BuildId", "42suffix", /positive 32-bit/]
    ] as const) {
        it(`rejects invalid ${key} before invoking the tool`, async () => {
            variables[key] = value;
            await assert.rejects(publishArtifacts(runtime, service, tool, new AbortController().signal), expected);
            assert.equal(calls.length, 0);
        });
    }

    it("does not accept an unknown publish location", async () => {
        values.artifactType = "unexpected";
        await assert.rejects(publishArtifacts(runtime, service, tool, new AbortController().signal), /Unrecognized/);
        assert.equal(calls.length, 0);
    });

    it("does not invoke a transfer after cancellation", async () => {
        const controller = new AbortController();
        controller.abort();
        await assert.rejects(publishArtifacts(runtime, service, tool, controller.signal));
        assert.equal(calls.length, 0);
    });

    it("associates Windows file-share artifacts before copying and clamps parallelism", async function () {
        if (process.platform !== "win32") { this.skip(); }
        values.artifactType = "filepath";
        values.fileSharePath = path.join(root, "share");
        values.parallel = "true";
        values.parallelCount = "129";
        const order: string[] = [];
        service.associate = async (project, id, artifact) => {
            order.push("associate");
            assert.equal(project, "project");
            assert.equal(id, 42);
            assert.equal(artifact.source, "job");
            assert.equal(artifact.resource?.type, "filepath");
            assert.equal(artifact.resource?.data, values.fileSharePath);
        };
        tool.copy = async (from, to, count) => {
            order.push("copy");
            assert.equal(from, source);
            assert.equal(to, path.join(values.fileSharePath, "drop"));
            assert.equal(count, 128);
        };
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        assert.deepEqual(order, ["associate", "copy"]);
        assert.equal(warnings.length, 1);
        assert.equal(calls.length, 0);
    });

    it("handles single-file file-share publishing without copying siblings", async function () {
        if (process.platform !== "win32") { this.skip(); }
        values.path = path.join(source, "one.txt");
        await fs.writeFile(values.path, "one");
        values.artifactType = "filepath";
        values.fileSharePath = path.join(root, "share");
        service.associate = async () => {};
        let copied = false;
        tool.copy = async (from, to, count, file) => {
            copied = true;
            assert.equal(from, source);
            assert.equal(file, "one.txt");
            assert.equal(count, 1);
        };
        await publishArtifacts(runtime, service, tool, new AbortController().signal);
        assert.equal(copied, true);
    });

    for (const json of ["null", "[]", '{"RootId":"override"}', '{"user-n":1}', '{"user-x":null}', "not json"]) {
        it(`rejects invalid custom properties ${json}`, () => {
            assert.throws(() => parseProperties(json));
        });
    }

    for (const name of ["..", " . ", "../outside", "a\\b", "a:b", "line\nbreak", ""]) {
        it(`rejects unsafe artifact name ${JSON.stringify(name)}`, () => {
            assert.throws(() => validateArtifactName(name));
        });
    }

    for (const id of ["0", "-1", "1e3", "42x", "2147483648"]) {
        it(`rejects invalid numeric ID ${id}`, () => {
            assert.throws(() => positiveId(id, "ID"));
        });
    }

    it("rejects relative/script tool paths and accepts a real local executable", async () => {
        await assert.rejects(validateExecutable("artifacttool.exe"), /absolute/);
        await assert.rejects(validateExecutable(path.join(root, "artifacttool.cmd")), /native/);
        assert.equal(await validateExecutable(process.execPath), process.execPath);
    });

    it("rejects token destinations outside the service allowlist", () => {
        for (const url of ["http://dev.azure.com/org", "https://dev.azure.com.evil.test", "https://user:password@dev.azure.com/org"]) {
            assert.throws(() => validateServiceUrl(url));
        }
        validateServiceUrl("https://dev.azure.com/org");
    });

    it("passes metacharacters as data rather than shell syntax", async () => {
        const lines: string[] = [];
        const value = "space & quote ' ; $(command)";
        const code = await executeProcess(process.execPath, ["-e", "console.log(process.argv[1])", value],
            process.env, new AbortController().signal, line => { lines.push(line); });
        assert.equal(code, 0);
        assert.deepEqual(lines, [value]);
    });

    it("passes authentication only in the child environment and reports the exit code", async () => {
        const tool = createArtifactTool(process.execPath, "https://dev.azure.com/org", "test-token-not-a-secret", new AbortController().signal);
        await tool.run(["-e", "if(process.env.PIPELINE_ARTIFACT_DEV_TOKEN!=='test-token-not-a-secret'||process.argv.includes('test-token-not-a-secret'))process.exit(9)", "--"]);
        await assert.rejects(tool.run(["-e", "process.exit(7)", "--"]), /exit code 7/);
    });

    it("terminates a running child when cancelled", async () => {
        const controller = new AbortController();
        const running = executeProcess(process.execPath, ["-e", "console.log('ready'); setInterval(()=>{},1000)"],
            process.env, controller.signal, line => { if (line === "ready") { controller.abort(); } });
        await assert.rejects(running);
    });

    it("rejects traversal and symbolic-link destinations", async () => {
        assert.throws(() => safeDestination(root, "../outside"));
        assert.throws(() => safeDestination(root, "C:\\outside"));
        const real = path.join(root, "real");
        const linked = path.join(root, "linked");
        await fs.mkdir(real);
        await fs.symlink(real, linked, process.platform === "win32" ? "junction" : "dir");
        assert.throws(() => safeDestination(root, "linked/file"), /symbolic links/);
        await fs.unlink(linked);
    });

    it("loads the packaged publish entry point and fails invalid build input", async () => {
        const manifest = JSON.parse(await fs.readFile(path.join(__dirname, "..", "task.json"), "utf8"));
        assert.equal(manifest.preview, true);
        assert.notEqual(manifest.id.toLowerCase(), "ecdc45f6-832d-4ad9-b52b-ee49e94659be");
        assert.deepEqual(Object.keys(manifest.execution), ["Node24"]);
        const lines: string[] = [];
        const code = await executeProcess(process.execPath, [path.join(__dirname, "..", "publish.js")], {
            ...process.env,
            INPUT_ARTIFACTTOOLPATH: process.execPath, INPUT_PATH: source,
            INPUT_ARTIFACTTYPE: "pipeline",
            SYSTEM_SERVERTYPE: "Hosted", SYSTEM_HOSTTYPE: "Build",
            SYSTEM_TEAMPROJECTID: "project", BUILD_BUILDID: "0",
            ENDPOINT_URL_SYSTEMVSSCONNECTION: "https://dev.azure.com/test",
            ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN: "test-token-not-a-secret"
        }, new AbortController().signal, line => { lines.push(line); });
        assert.equal(code, 0);
        assert.match(lines.join("\n"), /task.complete result=Failed/);
        assert.match(lines.join("\n"), /positive 32-bit integer/);
        assert.doesNotMatch(lines.join("\n"), /result=Succeeded/);
    });
});
