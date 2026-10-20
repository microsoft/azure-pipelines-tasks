import * as fs from "node:fs";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import { TaskInputs } from "./arguments";
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
        rename: (from, to) => fs.renameSync(from, to),
        removeDirectory: directory => fs.rmSync(directory, { recursive: true, force: true }),
        tempDirectory: () => tl.getVariable("Agent.TempDirectory") ?? os.tmpdir(),
        uniqueName: () => randomUUID(),
        debug: message => tl.debug(message)
    };
}

/**
 * Runs a pipeline artifact task: acquires ArtifactTool and runs it with the mapped arguments. ArtifactTool
 * reports output variables, warnings, and errors itself; the task only reports success or failure.
 */
export async function runTask(buildArguments: (task: TaskInputs) => string[]): Promise<void> {
    try {
        const serviceUrl = tl.getEndpointUrlRequired("SYSTEMVSSCONNECTION");
        const token = tl.getEndpointAuthorizationParameterRequired("SYSTEMVSSCONNECTION", "AccessToken");
        tl.setSecret(token);

        const args = buildArguments(taskInputs);
        const executable = await resolveArtifactTool(createResolverDeps(), serviceUrl);
        args.push("--service", serviceUrl, "--patvar", TokenVariable);
        if (tl.getVariable("System.Debug")?.toLowerCase() === "true") {
            args.push("--verbosity", "Debug");
        }

        const exitCode = await runArtifactTool({
            executable,
            args,
            token,
            cwd: tl.getVariable("System.DefaultWorkingDirectory") ?? process.cwd()
        });

        // ArtifactTool has already logged the error; an empty message avoids reporting it twice.
        tl.setResult(exitCode === 0 ? tl.TaskResult.Succeeded : tl.TaskResult.Failed, "");
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
    }
}
