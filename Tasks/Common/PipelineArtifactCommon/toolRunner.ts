import { Writable } from "node:stream";
import * as tl from "azure-pipelines-task-lib/task";

/** Environment variable that carries the job access token to ArtifactTool via --patvar. */
export const TokenVariable = "PIPELINE_ARTIFACT_ACCESS_TOKEN";

export interface RunOptions {
    executable: string;
    args: string[];
    token: string;
    cwd: string;
    /** Receives ArtifactTool's output. Defaults to stdout. */
    outStream?: Writable;
}

/**
 * Runs ArtifactTool through task-lib without a shell. The access token is passed only in the child's
 * environment. ArtifactTool's output is treated as untrusted: task-lib neutralizes every logging command
 * in it, so only the task reports results to the agent.
 */
export function runArtifactTool(options: RunOptions): Promise<number> {
    const out = options.outStream ?? process.stdout;
    return tl.tool(options.executable).arg(options.args).exec({
        cwd: options.cwd,
        env: { ...process.env, [TokenVariable]: options.token },
        silent: false,
        failOnStdErr: false,
        ignoreReturnCode: true,
        windowsVerbatimArguments: false,
        outStream: out,
        errStream: out,
        externalOutput: { source: "childProcess" }
    });
}