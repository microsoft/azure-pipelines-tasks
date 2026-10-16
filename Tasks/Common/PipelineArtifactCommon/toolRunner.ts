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

/** Receives relayed ArtifactTool output. Warnings become task warnings; debug output is shown only in debug runs. */
export interface OutputSink {
    info(line: string): void;
    warning(message: string): void;
    debug(message: string): void;
}

export interface ToolLogEntry {
    level: "debug" | "info" | "warning" | "error";
    text: string;
}

/**
 * Converts one line of ArtifactTool console output into readable text. ArtifactTool writes Serilog compact
 * JSON events ({"@m": message, "@l": level, "@x": exception}); anything else is passed through as information.
 */
export function parseToolLine(line: string): ToolLogEntry {
    const trimmed = line.trim();
    if (trimmed.startsWith("{")) {
        try {
            const event = JSON.parse(trimmed) as Record<string, unknown>;
            if (event && typeof event["@m"] === "string") {
                const exception = typeof event["@x"] === "string" ? `\n${event["@x"]}` : "";
                return { level: toLevel(event["@l"]), text: `${event["@m"]}${exception}` };
            }
        } catch {
            // Not a structured event; relay as-is.
        }
    }
    return { level: "info", text: line };
}

function toLevel(level: unknown): ToolLogEntry["level"] {
    switch (level) {
        case "Verbose":
        case "Debug":
            return "debug";
        case "Warning":
            return "warning";
        case "Error":
        case "Fatal":
            return "error";
        default:
            return "info";
    }
}

/**
 * Relays one line of tool output with logging commands neutralized. Errors are printed as text rather than
 * logged as issues, because the task reports the failure once from the result file.
 */
export function relayToolLine(line: string, sink: OutputSink): void {
    const entry = parseToolLine(line);
    const lines = entry.text.split(/\r?\n/).map(neutralizeLoggingCommands);
    switch (entry.level) {
        case "warning":
            sink.warning(lines.join(" ").trim());
            break;
        case "debug":
            lines.forEach(text => sink.debug(text));
            break;
        default:
            lines.forEach(text => sink.info(text));
            break;
    }
}

const consoleSink: OutputSink = {
    info: line => process.stdout.write(`${line}\n`),
    warning: message => process.stdout.write(`${message}\n`),
    debug: () => undefined
};

export interface RunOptions {
    executable: string;
    args: string[];
    token: string;
    cwd: string;
    signal: AbortSignal;
    sink?: OutputSink;
}

/**
 * Runs ArtifactTool without a shell. The access token is passed only through the child's environment,
 * never on the command line. Every output line is relayed with logging commands neutralized.
 */
export function runArtifactTool(options: RunOptions): Promise<number> {
    const sink = options.sink ?? consoleSink;
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
                relayToolLine(pending[index].slice(0, newline).replace(/\r$/, ""), sink);
                pending[index] = pending[index].slice(newline + 1);
            }
            if (final && pending[index]) {
                relayToolLine(pending[index], sink);
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
