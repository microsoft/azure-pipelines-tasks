import { randomBytes } from "node:crypto";
import * as os from "node:os";
import { Writable } from "node:stream";
import * as tl from "azure-pipelines-task-lib/task";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";

/** Environment variable that carries the job access token to ArtifactTool via --patvar. */
export const TokenVariable = "PIPELINE_ARTIFACT_ACCESS_TOKEN";

/** Environment variable that carries the token ArtifactTool uses to resume agent command processing. */
export const ResumeTokenVariable = "PIPELINE_ARTIFACT_RESUME_TOKEN";

/**
 * The only logging commands ArtifactTool output may contain. Command processing is paused while ArtifactTool
 * runs, so these take effect only after ArtifactTool resumes it with the token, as its last action.
 */
export const AllowedToolCommands: readonly string[] = ["agent.resumecommands", "task.setvariable", "task.logissue"];

export interface RunOptions {
    executable: string;
    args: string[];
    token: string;
    cwd: string;
    /** Receives the task's and ArtifactTool's output. Defaults to stdout. */
    outStream?: Writable;
}

/**
 * Runs ArtifactTool with agent command processing paused, so nothing it prints while working (file names,
 * server messages) can act as a logging command. Only ArtifactTool knows the resume token; it resumes after
 * all its work and reports its outputs, warnings, and error. Processing is always resumed when it exits.
 */
export async function runArtifactTool(options: RunOptions): Promise<number> {
    const out = options.outStream ?? process.stdout;
    const resumeToken = randomBytes(32).toString("hex");
    tl.setSecret(resumeToken);
    // Created before pausing: the constructor logs debug messages, which would print as raw text while paused.
    // The runner's own debug events are not subscribed to for the same reason.
    const tool = new ToolRunner(options.executable).arg(options.args);

    out.write(`##vso[agent.pausecommands]${resumeToken}${os.EOL}`);
    try {
        return await tool.exec({
            cwd: options.cwd,
            env: { ...process.env, [TokenVariable]: options.token, [ResumeTokenVariable]: resumeToken },
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: true,
            windowsVerbatimArguments: false,
            outStream: out,
            errStream: out,
            externalOutput: { source: "childProcess", enableVsoCommands: true, allowedVsoCommands: AllowedToolCommands }
        });
    } finally {
        out.write(`##vso[agent.resumecommands]${resumeToken}${os.EOL}`);
    }
}
