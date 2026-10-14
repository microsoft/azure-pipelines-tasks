import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import { TaskInputs } from "./arguments";
import { parseResult } from "./result";
import { TokenVariable, runArtifactTool } from "./toolRunner";
import { ToolResolverDeps, resolveArtifactTool } from "./toolResolver";

export const taskInputs: TaskInputs = {
    input: (name, required) => tl.getInput(name, required) ?? "",
    boolInput: name => tl.getBoolInput(name, false),
    variable: name => tl.getVariable(name)
};

export function createResolverDeps(): ToolResolverDeps {
    return {
        variable: name => tl.getVariable(name),
        setVariable: (name, value) => tl.setVariable(name, value),
        platform: process.platform,
        arch: process.arch,
        exists: file => fs.existsSync(file),
        readOsRelease: () => fs.existsSync("/etc/os-release") ? fs.readFileSync("/etc/os-release", "utf8") : undefined,
        fetchJson: async url => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Request to ${url} failed with ${response.status} ${response.statusText}.`);
            }
            return response.json();
        },
        downloadFile: url => toolLib.downloadTool(url),
        extractZip: async (file, destination) => {
            await toolLib.extractZip(file, destination);
        },
        makeExecutable: file => fs.chmodSync(file, 0o755),
        tempDirectory: () => tl.getVariable("Agent.TempDirectory") ?? os.tmpdir(),
        uniqueName: () => randomUUID(),
        debug: message => tl.debug(message)
    };
}

/**
 * Runs a pipeline artifact task: acquires ArtifactTool, invokes it with the mapped arguments, and
 * publishes declared outputs from the tool's result file.
 */
export async function runTask(buildArguments: (task: TaskInputs) => string[], outputs: readonly string[]): Promise<void> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    let resultFile: string | undefined;
    try {
        const serviceUrl = tl.getEndpointUrlRequired("SYSTEMVSSCONNECTION");
        const token = tl.getEndpointAuthorizationParameterRequired("SYSTEMVSSCONNECTION", "AccessToken");
        tl.setSecret(token);

        const args = buildArguments(taskInputs);
        const executable = await resolveArtifactTool(createResolverDeps(), serviceUrl);
        const tempDirectory = tl.getVariable("Agent.TempDirectory") ?? path.dirname(executable);
        resultFile = path.join(tempDirectory, `pipeline-artifact-result-${randomUUID()}.json`);
        args.push("--service", serviceUrl, "--patvar", TokenVariable, "--result-file", resultFile);
        if (tl.getVariable("System.Debug")?.toLowerCase() === "true") {
            args.push("--verbosity", "Debug");
        }

        const exitCode = await runArtifactTool({
            executable,
            args,
            token,
            cwd: tl.getVariable("System.DefaultWorkingDirectory") ?? process.cwd(),
            signal: controller.signal
        });

        const result = fs.existsSync(resultFile) ? parseResult(fs.readFileSync(resultFile, "utf8"), outputs) : undefined;
        for (const [name, value] of Object.entries(result?.outputs ?? {})) {
            tl.setVariable(name, value);
        }

        if (exitCode === 0 && result?.status === "Succeeded") {
            tl.setResult(tl.TaskResult.Succeeded, "");
        } else if (result?.status === "Cancelled") {
            tl.setResult(tl.TaskResult.Cancelled, result.message ?? "ArtifactTool was cancelled.");
        } else {
            tl.setResult(tl.TaskResult.Failed, result?.message ?? `ArtifactTool failed with exit code ${exitCode}.`);
        }
    } catch (error) {
        tl.setResult(controller.signal.aborted ? tl.TaskResult.Cancelled : tl.TaskResult.Failed,
            error instanceof Error ? error.message : String(error));
    } finally {
        process.removeListener("SIGINT", cancel);
        process.removeListener("SIGTERM", cancel);
        if (resultFile && fs.existsSync(resultFile)) {
            fs.rmSync(resultFile, { force: true });
        }
    }
}
