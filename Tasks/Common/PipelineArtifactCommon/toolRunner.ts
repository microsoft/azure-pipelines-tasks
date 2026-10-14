import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

/** Environment variable that carries the job access token to ArtifactTool via --patvar. */
export const TokenVariable = "PIPELINE_ARTIFACT_ACCESS_TOKEN";

/**
 * Prevents relayed tool output from being interpreted as agent logging commands. The agent recognizes
 * the command prefix anywhere in a line, so prefixing the line is not sufficient.
 */
export function neutralizeLoggingCommands(line: string): string {
    return line.replace(/##vso\[/gi, "##_vso[");
}

export interface RunOptions {
    executable: string;
    args: string[];
    token: string;
    cwd: string;
    signal: AbortSignal;
    write?: (line: string) => void;
}

/**
 * Runs ArtifactTool without a shell. The access token is passed only through the child's environment,
 * never on the command line. Every output line is relayed with logging commands neutralized.
 */
export function runArtifactTool(options: RunOptions): Promise<number> {
    const write = options.write ?? (line => process.stdout.write(`${line}\n`));
    options.signal.throwIfAborted();
    return new Promise<number>((resolve, reject) => {
        const child = spawn(options.executable, options.args, {
            cwd: options.cwd,
            env: { ...process.env, [TokenVariable]: options.token },
            shell: false,
            windowsHide: true,
            signal: options.signal,
            stdio: ["ignore", "pipe", "pipe"]
        });

        const pending = ["", ""];
        const decoders = [new StringDecoder("utf8"), new StringDecoder("utf8")];
        const relay = (index: number, text: string, final: boolean) => {
            pending[index] += text;
            let newline: number;
            while ((newline = pending[index].indexOf("\n")) >= 0) {
                write(neutralizeLoggingCommands(pending[index].slice(0, newline).replace(/\r$/, "")));
                pending[index] = pending[index].slice(newline + 1);
            }
            if (final && pending[index]) {
                write(neutralizeLoggingCommands(pending[index]));
                pending[index] = "";
            }
        };

        child.stdout.on("data", (data: Buffer) => relay(0, decoders[0].write(data), false));
        child.stderr.on("data", (data: Buffer) => relay(1, decoders[1].write(data), false));
        child.once("error", reject);
        child.once("close", code => {
            relay(0, decoders[0].end(), true);
            relay(1, decoders[1].end(), true);
            if (options.signal.aborted || code === null) {
                reject(new Error("ArtifactTool was cancelled."));
            } else {
                resolve(code);
            }
        });
    });
}
