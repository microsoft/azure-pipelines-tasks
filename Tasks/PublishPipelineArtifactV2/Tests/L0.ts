import * as assert from "assert";
import * as path from "path";
import { Writable } from "stream";
import {
    PublishEnvironment,
    TaskInputs,
    ToolResolverDeps,
    TokenVariable,
    downloadUrl,
    normalizeJobIdentifier,
    parseParallelCount,
    preparePublish,
    resolveArtifactTool,
    runArtifactTool,
    toolDirectory,
    toolPlatform,
    validateArtifactName
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

    describe("artifact names", () => {
        it("derives the default name from the job identifier like the previous major", () => {
            assert.strictEqual(normalizeJobIdentifier("Build_Job.default"), "BuildJob");
            assert.strictEqual(normalizeJobIdentifier("Stage 1.Job-A.default"), "Stage 1.JobA");
        });

        it("rejects invalid names with the previous major's message", () => {
            assert.throws(() => validateArtifactName("a/b"), /^Error: Artifact name is not valid: a\/b\. It cannot contain '\\', '\/', '"', ':', '<', '>', '\|', '\*', '\?', or control characters\. It cannot be empty or consist entirely of dots or spaces\.$/);
            assert.throws(() => validateArtifactName(" . "), /Artifact name is not valid/);
            assert.throws(() => validateArtifactName("tab\there"), /Artifact name is not valid/);
            validateArtifactName("##vso[task.setvariable variable=x]y");
        });
    });

    describe("preparePublish", () => {
        const variables = {
            "System.TeamProjectId": "project-id",
            "Build.BuildId": "42",
            "System.JobIdentifier": "Build.Job.__default",
            "System.JobId": "job-id",
            "System.HostType": "build",
            "System.DefaultWorkingDirectory": path.resolve("work")
        };
        const windows: PublishEnvironment = { platform: "win32", exists: () => true };

        it("resolves the path, maps the inputs, and leaves properties to ArtifactTool", () => {
            const plan = preparePublish(inputs({ path: "out", artifactName: "drop", properties: "{\"user-a\":1}" }, variables), windows);

            assert.deepStrictEqual(plan.args, [
                "pipelineartifact", "publish", "--project", "project-id", "--pipeline-id", "42",
                "--path", path.resolve("work", "out"), "--artifact-name", "drop", "--artifact-type", "pipeline",
                "--properties", "{\"user-a\":1}", "--job-id", "job-id"
            ]);
            assert.deepStrictEqual(plan.warnings, []);
        });

        it("defaults the artifact name to the normalized job identifier", () => {
            const plan = preparePublish(inputs({ path: "out" }, variables), windows);

            assert.strictEqual(optionValue(plan.args, "--artifact-name"), "Build.Job");
        });

        it("validates the name, host type, run ID, and path before ArtifactTool runs", () => {
            assert.throws(() => preparePublish(inputs({ path: "out", artifactName: "a:b" }, variables), windows), /Artifact name is not valid: a:b/);
            assert.throws(() => preparePublish(inputs({ path: "out", artifactName: "drop" }, { ...variables, "System.HostType": "release" }), windows),
                /published only from build jobs, not 'release' jobs/);
            assert.throws(() => preparePublish(inputs({ path: "out", artifactName: "drop" }, { ...variables, "Build.BuildId": "" }), windows), /Build\.BuildId/);
            assert.throws(() => preparePublish(inputs({ path: "out", artifactName: "drop" }, variables), { platform: "win32", exists: () => false }),
                new RegExp(`^Error: Path does not exist: ${path.resolve("work", "out").replace(/\\/g, "\\\\")}$`));
            assert.throws(() => preparePublish(inputs({ path: "out", artifactType: "zip" }, variables), windows), /Artifact type 'zip' is not recognized/);
        });

        it("passes file share options and clamps the parallel count with a warning", () => {
            const plan = preparePublish(inputs({ path: "out", artifactType: "FilePath", fileSharePath: "\\\\share\\drop", parallel: "true", parallelCount: "500" },
                { ...variables, "System.HostType": "release" }), windows);

            assert.strictEqual(optionValue(plan.args, "--artifact-type"), "filepath");
            assert.strictEqual(optionValue(plan.args, "--file-share-path"), "\\\\share\\drop");
            assert.strictEqual(optionValue(plan.args, "--parallel-count"), "128");
            assert.deepStrictEqual(plan.warnings, ["The parallel count must be at least 1 and not greater than 128; using the nearest allowed value."]);
        });

        it("omits the parallel count when parallel copy is off and rejects file shares off Windows", () => {
            const plan = preparePublish(inputs({ path: "out", artifactType: "filepath", fileSharePath: "\\\\share\\drop", parallelCount: "16" }, variables), windows);

            assert.strictEqual(plan.args.indexOf("--parallel-count"), -1);
            assert.throws(() => preparePublish(inputs({ path: "out", artifactType: "filepath", fileSharePath: "/mnt/share" }, variables),
                { platform: "linux", exists: () => true }), /supported only on Windows/);
            assert.throws(() => parseParallelCount("many", []), /must be a number/);
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
        function fakeDeps(overrides: Partial<ToolResolverDeps> = {}): ToolResolverDeps & { calls: string[]; variables: Record<string, string>; existing: Set<string> } {
            const variables: Record<string, string> = {};
            const existing = new Set<string>();
            const calls: string[] = [];
            const deps: ToolResolverDeps & { calls: string[]; variables: Record<string, string>; existing: Set<string> } = {
                calls,
                variables,
                existing,
                variable: name => variables[name],
                platform: "linux",
                arch: "x64",
                exists: file => existing.has(file),
                readOsRelease: () => "ID=ubuntu",
                fetchJson: async url => { calls.push(`fetch ${url}`); return { locationUrl: "https://vsblob.example/org" }; },
                downloadFile: async url => { calls.push(`download ${url}`); return "/tmp/tool.zip"; },
                extractZip: async (file, destination) => { calls.push(`extract ${file} to ${destination}`); existing.add(path.join(destination, "artifacttool")); },
                makeExecutable: file => { calls.push(`chmod ${file}`); },
                rename: (from, to) => { calls.push(`rename ${from} to ${to}`); existing.add(path.join(to, "artifacttool")); },
                removeDirectory: directory => { calls.push(`remove ${directory}`); },
                tempDirectory: () => "/agent/_temp",
                uniqueName: () => "unique",
                debug: () => undefined,
                ...overrides
            };
            return deps;
        }

        const cacheDirectory = path.join("/agent/_temp", "ArtifactTool", "Linux-amd64");

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

        it("uses a fixed per-platform directory under the agent temp directory", () => {
            assert.strictEqual(toolDirectory("/agent/_temp", { osName: "Windows", arch: "amd64" }), path.join("/agent/_temp", "ArtifactTool", "Windows-amd64"));
            assert.strictEqual(toolDirectory("/agent/_temp", { osName: "Linux", arch: "amd64", distroName: "Alpine" }), path.join("/agent/_temp", "ArtifactTool", "Linux-amd64-Alpine"));
        });

        it("downloads anonymously into a staging directory and moves it into the fixed job cache", async () => {
            const deps = fakeDeps();

            const tool = await resolveArtifactTool(deps, "https://dev.azure.com/org/");

            const staging = `${cacheDirectory}.unique`;
            assert.strictEqual(tool, path.join(cacheDirectory, "artifacttool"));
            assert.deepStrictEqual(deps.calls, [
                "fetch https://dev.azure.com/org/_apis/resourceAreas/5294ef93-12a1-4d13-8671-9d9d014072c8?api-version=5.0-preview.1",
                "download https://vsblob.example/org/_apis/clienttools/artifacttool/download?api-version=5.0-preview.1&osName=Linux&arch=amd64",
                `extract /tmp/tool.zip to ${staging}`,
                `chmod ${path.join(staging, "artifacttool")}`,
                `remove ${cacheDirectory}`,
                `rename ${staging} to ${cacheDirectory}`
            ]);
        });

        it("reuses the tool from the fixed job cache without any network access", async () => {
            const deps = fakeDeps();
            deps.existing.add(path.join(cacheDirectory, "artifacttool"));

            assert.strictEqual(await resolveArtifactTool(deps, "https://dev.azure.com/org/"), path.join(cacheDirectory, "artifacttool"));
            assert.deepStrictEqual(deps.calls, []);
        });

        it("ignores pipeline variables when locating the cached tool", async () => {
            const deps = fakeDeps();
            deps.variables["PIPELINEARTIFACT_ARTIFACTTOOL_PATH_LINUX_AMD64"] = "/attacker/artifacttool";
            deps.existing.add("/attacker/artifacttool");

            const tool = await resolveArtifactTool(deps, "https://dev.azure.com/org/");

            assert.strictEqual(tool, path.join(cacheDirectory, "artifacttool"));
        });

        it("fails when the service does not report a client tool location", async () => {
            const deps = fakeDeps({ fetchJson: async () => ({}) });

            await assert.rejects(resolveArtifactTool(deps, "https://dev.azure.com/org/"), /Unable to locate/);
        });

        it("fails and cleans up when the downloaded package has no executable", async () => {
            const deps = fakeDeps({ extractZip: async () => undefined });

            await assert.rejects(resolveArtifactTool(deps, "https://dev.azure.com/org/"), /does not contain artifacttool/);
            assert.deepStrictEqual(deps.calls.slice(-1), [`remove ${cacheDirectory}.unique`]);
        });
    });

    describe("runArtifactTool", () => {
        function capture(): { stream: Writable; lines: () => string[] } {
            let text = "";
            const stream = new Writable({ write(chunk, _encoding, callback) { text += chunk.toString(); callback(); } });
            return { stream, lines: () => text.split(/\r?\n/).filter(line => line.length > 0) };
        }

        it("passes the token only through the environment and returns the exit code", async () => {
            const output = capture();
            const script = [
                `console.log("length:" + process.env.${TokenVariable}.length + " args:" + process.argv.slice(1).join(","));`,
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
            assert.strictEqual(exitCode, 3);
            assert.ok(lines.includes("length:18 args:plain-arg"), lines.join("\n"));
            assert.ok(!lines.some(line => line.includes("access-token-value")), lines.join("\n"));
        });

        it("neutralizes every logging command in ArtifactTool output", async () => {
            const output = capture();
            const script = [
                "console.log('##vso[task.setvariable variable=BuildNumber;]42');",
                "console.log('name ##vso[task.complete result=Succeeded;]done');",
                "console.error('##vso[task.prependpath]C:\\\\evil');"
            ].join("\n");

            await runArtifactTool({ executable: process.execPath, args: ["-e", script], token: "t", cwd: process.cwd(), outStream: output.stream });

            const text = output.lines().join("\n");
            assert.ok(text.includes("##_vso[task.setvariable variable=BuildNumber;]42"), text);
            assert.ok(text.includes("name ##_vso[task.complete result=Succeeded;]done"), text);
            assert.ok(text.includes("##_vso[task.prependpath]C:\\evil"), text);
            assert.ok(!/(^|[^_])##vso\[/.test(text.split("\n").filter(line => !line.startsWith("[command]")).join("\n")), text);
        });
    });});
