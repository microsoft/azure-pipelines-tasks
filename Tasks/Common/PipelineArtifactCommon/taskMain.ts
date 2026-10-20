import * as fs from "node:fs";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import * as tl from "azure-pipelines-task-lib/task";
import * as toolLib from "azure-pipelines-tool-lib/tool";
import { PipelineBuildService, createBuildService } from "./buildService";
import { TaskInputs, ToolPlan } from "./inputs";
import { TokenVariable, runArtifactTool } from "./toolRunner";
import { ToolResolverDeps, resolveArtifactTool } from "./toolResolver";

/** What a task's input processing can use. */
export interface TaskContext {
    task: TaskInputs;
    buildService(): PipelineBuildService;
    /** Logs a message that may contain service-provided text, with logging commands neutralized. */
    log(message: string): void;
}

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
 * Runs a pipeline artifact task: processes the inputs into a plan, acquires ArtifactTool, reports the plan's
 * warnings and variables, and runs ArtifactTool for the transfer. ArtifactTool reports nothing to the agent;
 * the task sets the result from its exit code.
 */
export async function runTask(prepare: (context: TaskContext) => Promise<ToolPlan>): Promise<void> {
    try {
        const serviceUrl = tl.getEndpointUrlRequired("SYSTEMVSSCONNECTION");
        const token = tl.getEndpointAuthorizationParameterRequired("SYSTEMVSSCONNECTION", "AccessToken");
        tl.setSecret(token);

        const plan = await prepare({
            task: taskInputs,
            buildService: () => createBuildService(tl.getVariable("System.TeamFoundationCollectionUri") || serviceUrl, token),
            log: message => tl.writeExternalOutput(message + os.EOL, { source: "remote" })
        });
        const executable = await resolveArtifactTool(createResolverDeps(), serviceUrl);

        for (const warning of plan.warnings) {
            tl.warning(warning);
        }
        for (const [name, value] of Object.entries(plan.variables)) {
            tl.setVariable(name, value);
        }

        const args = [...plan.args, "--service", serviceUrl, "--patvar", TokenVariable, "--stdout-logging", "--unstructured-logging"];
        if (tl.getVariable("System.Debug")?.toLowerCase() === "true") {
            args.push("--verbosity", "Debug");
        }

        const exitCode = await runArtifactTool({
            executable,
            args,
            token,
            cwd: tl.getVariable("System.DefaultWorkingDirectory") ?? process.cwd()
        });
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, `ArtifactTool failed with exit code ${exitCode}. See the log above for details.`);
            return;
        }

        for (const [name, value] of Object.entries(plan.variablesOnSuccess)) {
            tl.setVariable(name, value);
        }
        tl.setResult(tl.TaskResult.Succeeded, "");
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error instanceof Error ? error.message : String(error));
    }
}
