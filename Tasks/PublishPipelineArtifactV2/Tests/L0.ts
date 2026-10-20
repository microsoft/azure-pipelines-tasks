import * as assert from "assert";
import * as path from "path";
import { Writable } from "stream";
import {
    AllowedToolCommands,
    ResumeTokenVariable,
    TaskInputs,
    ToolResolverDeps,
    TokenVariable,
    downloadUrl,
    publishArguments,
    resolveArtifactTool,
    runArtifactTool,
    toolPlatform
} from "pipeline-artifact-common";

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

describe("PublishPipelineArtifact L0 Suite", function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "20000"));

    describe("publishArguments", () => {
        const variables = {
            "System.TeamProjectId": "project-id",
            "Build.BuildId": "42",
            "System.JobIdentifier": "Build.Job",
            "System.JobId": "job-id",
            "System.HostType": "build"
        };

        it("maps pipeline publish inputs and job variables", () => {
            const args = publishArguments(inputs({ path: "out", artifactName: "drop", properties: "{\"user-a\":\"1\"}" }, variables));

            assert.deepStrictEqual(args.slice(0, 2), ["pipelineartifact", "publish"]);
            assert.strictEqual(optionValue(args, "--project"), "project-id");
            assert.strictEqual(optionValue(args, "--pipeline-id"), "42");
            assert.strictEqual(optionValue(args, "--path"), "out");
            assert.strictEqual(optionValue(args, "--artifact-name"), "drop");
            assert.strictEqual(optionValue(args, "--job-identifier"), "Build.Job");
            assert.strictEqual(optionValue(args, "--properties"), "{\"user-a\":\"1\"}");
            assert.strictEqual(optionValue(args, "--artifact-type"), "pipeline");
            assert.strictEqual(args.indexOf("--file-share-path"), -1);
        });

        it("omits the artifact name so ArtifactTool applies the job default", () => {
            const args = publishArguments(inputs({ path: "out" }, variables));

            assert.strictEqual(args.indexOf("--artifact-name"), -1);
        });

        it("passes file share options only for file share publishes", () => {
            const args = publishArguments(inputs({ path: "out", artifactType: "filepath", fileSharePath: "\\\\share\\drop", parallel: "true", parallelCount: "16" }, variables));

            assert.strictEqual(optionValue(args, "--artifact-type"), "filepath");
            assert.strictEqual(optionValue(args, "--file-share-path"), "\\\\share\\drop");
            assert.strictEqual(optionValue(args, "--parallel-count"), "16");
        });

        it("does not pass a parallel count when parallel copy is off", () => {
            const args = publishArguments(inputs({ path: "out", artifactType: "filepath", fileSharePath: "\\\\share\\drop", parallelCount: "16" }, variables));

            assert.strictEqual(args.indexOf("--parallel-count"), -1);
        });
    });

    describe("toolPlatform", () => {
        it("maps Windows, macOS and glibc Linux", () => {
            assert.deepStrictEqual(toolPlatform("win32", "x64", undefined), { osName: "Windows", arch: "amd64" });
            assert.deepStrictEqual(toolPlatform("darwin", "arm64", undefined), { osName: "Darwin", arch: "arm64" });
            assert.deepStrictEqual(toolPlatform("linux", "arm64", "ID=ubuntu\n"), { osName: "Linux", arch: "arm64" });
        });

        it("requests the Alpine build on musl x64", () => {
            assert.deepStrictEqual(toolPlatform("linux", "x64", "NAME=\"Alpine Linux\"\nID=alpine\n"), { osName: "Linux", arch: "amd64", distroName: "Alpine" });
        });

        it("fails clearly where no ArtifactTool build exists", () => {
            assert.throws(() => toolPlatform("win32", "ia32", undefined), /not available for win32-ia32/);
            assert.throws(() => toolPlatform("linux", "arm", "ID=debian"), /not available for linux-arm/);
            assert.throws(() => toolPlatform("linux", "arm64", "ID=alpine"), /Alpine Linux on arm64/);
        });

        it("builds the anonymous download URL", () => {
            assert.strictEqual(
                downloadUrl("https://vsblob.dev.azure.com/org", { osName: "Linux", arch: "amd64", distroName: "Alpine" }),
                "https://vsblob.dev.azure.com/org/_apis/clienttools/artifacttool/download?api-version=5.0-preview.1&osName=Linux&arch=amd64&distroName=Alpine");
        });
    });

    describe("resolveArtifactTool", () => {
        function fakeDeps(overrides: Partial<ToolResolverDeps> = {}): ToolResolverDeps & { calls: string[]; variables: Record<string, string> } {
            const variables: Record<string, string> = {};
            const existing = new Set<string>();
            const calls: string[] = [];
            const deps: ToolResolverDeps & { calls: string[]; variables: Record<string, string> } = {
                calls,
                variables,
                variable: name => variables[name],
                setVariable: (name, value) => { variables[name] = value; },
                platform: "linux",
                arch: "x64",
                exists: file => existing.has(file),
                readOsRelease: () => "ID=ubuntu",
                fetchJson: async url => { calls.push(`fetch ${url}`); return { locationUrl: "https://vsblob.example/org" }; },
                downloadFile: async url => { calls.push(`download ${url}`); return "/tmp/tool.zip"; },
                extractZip: async (file, destination) => { calls.push(`extract ${file}`); existing.add(path.join(destination, "artifacttool")); },
                makeExecutable: file => { calls.push(`chmod ${file}`); },
                tempDirectory: () => "/agent/_temp",
                uniqueName: () => "unique",
                debug: () => undefined,
                ...overrides
            };
            return deps;
        }

        it("uses the override directory without any network access", async () => {
            const overrideDir = path.resolve("override");
            const deps = fakeDeps({ exists: file => file === path.join(overrideDir, "artifacttool") });
            deps.variables["PipelineArtifact.OverrideArtifactToolPath"] = overrideDir;

            const tool = await resolveArtifactTool(deps, "https://dev.azure.com/org/");

            assert.strictEqual(tool, path.join(overrideDir, "artifacttool"));
            assert.deepStrictEqual(deps.calls, []);
        });

        it("rejects a relative or missing override directory", async () => {
            const deps = fakeDeps();
            deps.variables["PipelineArtifact.OverrideArtifactToolPath"] = "relative";

            await assert.rejects(resolveArtifactTool(deps, "https://dev.azure.com/org/"), /must be an absolute directory/);
        });

        it("downloads anonymously, extracts, and caches the tool for the job", async () => {
            const deps = fakeDeps();

            const tool = await resolveArtifactTool(deps, "https://dev.azure.com/org/");

            const expected = path.join("/agent/_temp", "ArtifactTool", "unique", "artifacttool");
            assert.strictEqual(tool, expected);
            assert.deepStrictEqual(deps.calls, [
                "fetch https://dev.azure.com/org/_apis/resourceAreas/5294ef93-12a1-4d13-8671-9d9d014072c8?api-version=5.0-preview.1",
                "download https://vsblob.example/org/_apis/clienttools/artifacttool/download?api-version=5.0-preview.1&osName=Linux&arch=amd64",
                "extract /tmp/tool.zip",
                `chmod ${expected}`
            ]);
            assert.strictEqual(deps.variables["PIPELINEARTIFACT_ARTIFACTTOOL_PATH_LINUX_AMD64"], expected);
        });

        it("reuses a tool downloaded earlier in the job", async () => {
            const deps = fakeDeps({ exists: file => file === "/cached/artifacttool" });
            deps.variables["PIPELINEARTIFACT_ARTIFACTTOOL_PATH_LINUX_AMD64"] = "/cached/artifacttool";

            assert.strictEqual(await resolveArtifactTool(deps, "https://dev.azure.com/org/"), "/cached/artifacttool");
            assert.deepStrictEqual(deps.calls, []);
        });

        it("fails when the service does not report a client tool location", async () => {
            const deps = fakeDeps({ fetchJson: async () => ({}) });

            await assert.rejects(resolveArtifactTool(deps, "https://dev.azure.com/org/"), /Unable to locate/);
        });

        it("fails when the downloaded package has no executable", async () => {
            const deps = fakeDeps({ extractZip: async () => undefined });

            await assert.rejects(resolveArtifactTool(deps, "https://dev.azure.com/org/"), /does not contain artifacttool/);
        });
    });

    describe("runArtifactTool", () => {
        function capture(): { stream: Writable; lines: () => string[] } {
            let text = "";
            const stream = new Writable({ write(chunk, _encoding, callback) { text += chunk.toString(); callback(); } });
            return { stream, lines: () => text.split(/\r?\n/).filter(line => line.length > 0) };
        }

        it("pauses commands, passes both tokens only through the environment, and always resumes", async () => {
            const output = capture();
            const script = [
                `console.log("token:" + (process.env.${TokenVariable} === process.argv[1]) + " length:" + process.env.${TokenVariable}.length);`,
                `console.log("resume:" + process.env.${ResumeTokenVariable});`,
                "process.exit(3);"
            ].join("\n");

            const exitCode = await runArtifactTool({
                executable: process.execPath,
                args: ["-e", script, "plain-arg"],
                token: "access-token-value",
                cwd: process.cwd(),
                outStream: output.stream
            });

            const lines = output.lines();
            const pause = /^##vso\[agent\.pausecommands\]([0-9a-f]{64})$/.exec(lines[0]);
            assert.ok(pause, lines.join("\n"));
            const token = pause![1];
            assert.strictEqual(exitCode, 3);
            assert.ok(lines.includes("token:false length:18"), lines.join("\n"));
            assert.ok(lines.includes(`resume:${token}`), lines.join("\n"));
            assert.strictEqual(lines[lines.length - 1], `##vso[agent.resumecommands]${token}`);
            assert.ok(!lines.some(line => line.includes("access-token-value")), lines.join("\n"));
        });

        it("lets only resume, set-variable, and issue commands through from ArtifactTool output", async () => {
            const output = capture();
            const script = [
                "console.log('##vso[task.setvariable variable=BuildNumber;]42');",
                "console.log('##vso[task.logissue type=warning]careful');",
                "console.log('##vso[task.complete result=Succeeded;]done');",
                "console.error('##vso[task.prependpath]C:\\\\evil');"
            ].join("\n");

            await runArtifactTool({ executable: process.execPath, args: ["-e", script], token: "t", cwd: process.cwd(), outStream: output.stream });

            const lines = output.lines();
            assert.deepStrictEqual([...AllowedToolCommands], ["agent.resumecommands", "task.setvariable", "task.logissue"]);
            assert.ok(lines.includes("##vso[task.setvariable variable=BuildNumber;]42"), lines.join("\n"));
            assert.ok(lines.includes("##vso[task.logissue type=warning]careful"), lines.join("\n"));
            assert.ok(lines.includes("##_vso[task.complete result=Succeeded;]done"), lines.join("\n"));
            assert.ok(lines.includes("##_vso[task.prependpath]C:\\evil"), lines.join("\n"));
        });
    });
});
