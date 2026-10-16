import * as assert from "assert";
import * as path from "path";
import {
    OutputSink,
    TaskInputs,
    ToolResolverDeps,
    TokenVariable,
    downloadUrl,
    neutralizeLoggingCommands,
    parseResult,
    parseToolLine,
    publishArguments,
    relayToolLine,
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

    describe("parseResult", () => {
        it("keeps only declared string outputs", () => {
            const result = parseResult(JSON.stringify({
                status: "Succeeded", exitCode: 0,
                outputs: { BuildNumber: "42", "System.AccessToken": "x", Other: 1 }
            }), ["BuildNumber"]);

            assert.strictEqual(result.status, "Succeeded");
            assert.deepStrictEqual(result.outputs, { BuildNumber: "42" });
        });

        it("reports failure messages", () => {
            const result = parseResult(JSON.stringify({ status: "Failed", exitCode: 21, message: "Artifact x was not found for build 1." }), []);

            assert.strictEqual(result.message, "Artifact x was not found for build 1.");
            assert.strictEqual(result.exitCode, 21);
        });

        it("rejects malformed result files", () => {
            assert.throws(() => parseResult("[]", []), /not a JSON object/);
            assert.throws(() => parseResult(JSON.stringify({ status: "Maybe" }), []), /unknown status/);
        });
    });

    describe("tool output relay", () => {
        function recordingSink(): OutputSink & { events: string[] } {
            const events: string[] = [];
            return {
                events,
                info: line => events.push(`info:${line}`),
                warning: message => events.push(`warning:${message}`),
                debug: message => events.push(`debug:${message}`)
            };
        }

        it("neutralizes logging commands anywhere in a line", () => {
            assert.strictEqual(neutralizeLoggingCommands("x ##vso[task.setvariable variable=a]b ##VSO[task.complete]"),
                "x ##_vso[task.setvariable variable=a]b ##_vso[task.complete]");
        });

        it("renders structured events by level", () => {
            assert.deepStrictEqual(parseToolLine("{\"@m\":\"hello\",\"@i\":\"1\"}"), { level: "info", text: "hello" });
            assert.deepStrictEqual(parseToolLine("{\"@m\":\"careful\",\"@l\":\"Warning\"}"), { level: "warning", text: "careful" });
            assert.deepStrictEqual(parseToolLine("{\"@m\":\"failed\",\"@l\":\"Error\",\"@x\":\"stack\"}"), { level: "error", text: "failed\nstack" });
            assert.deepStrictEqual(parseToolLine("plain text"), { level: "info", text: "plain text" });
            assert.deepStrictEqual(parseToolLine("{not json"), { level: "info", text: "{not json" });
        });

        it("sends warnings to the warning sink and splits multi-line messages", () => {
            const sink = recordingSink();

            relayToolLine("{\"@m\":\"use the other task\",\"@l\":\"Warning\"}", sink);
            relayToolLine("{\"@m\":\"line1\\r\\nline2\"}", sink);
            relayToolLine("{\"@m\":\"detail\",\"@l\":\"Debug\"}", sink);
            relayToolLine("{\"@m\":\"boom\",\"@l\":\"Error\"}", sink);

            assert.deepStrictEqual(sink.events, ["warning:use the other task", "info:line1", "info:line2", "debug:detail", "info:boom"]);
        });

        it("neutralizes logging commands inside structured messages", () => {
            const sink = recordingSink();

            relayToolLine("{\"@m\":\"name ##vso[task.setvariable variable=x]y\",\"@l\":\"Warning\"}", sink);

            assert.deepStrictEqual(sink.events, ["warning:name ##_vso[task.setvariable variable=x]y"]);
        });
    });

    describe("runArtifactTool", () => {
        it("passes the token only through the environment and relays neutralized output", async () => {
            const lines: string[] = [];
            const script = [
                `console.log(JSON.stringify({ "@m": "token:" + (process.env.${TokenVariable} === "secret") + " args:" + process.argv.slice(1).join(",") }));`,
                "console.error('##vso[task.setvariable variable=x]y');",
                "process.exit(3);"
            ].join("\n");

            const exitCode = await runArtifactTool({
                executable: process.execPath,
                args: ["-e", script, "plain-arg"],
                token: "secret",
                cwd: process.cwd(),
                signal: new AbortController().signal,
                sink: { info: line => lines.push(line), warning: line => lines.push(line), debug: () => undefined }
            });

            assert.strictEqual(exitCode, 3);
            assert.ok(lines.includes("token:true args:plain-arg"), lines.join("\n"));
            assert.ok(lines.includes("##_vso[task.setvariable variable=x]y"), lines.join("\n"));
            assert.ok(!lines.some(line => line.includes("secret")));
        });

        it("reports cancellation", async () => {
            const controller = new AbortController();
            const run = runArtifactTool({
                executable: process.execPath,
                args: ["-e", "setTimeout(() => undefined, 30000);"],
                token: "secret",
                cwd: process.cwd(),
                signal: controller.signal,
                sink: { info: () => undefined, warning: () => undefined, debug: () => undefined }
            });
            setTimeout(() => controller.abort(), 200);

            await assert.rejects(run, /cancelled|abort/i);
        });
    });
});
