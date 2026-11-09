import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import * as tl from "azure-pipelines-task-lib/task";
import { validateServiceUrl } from "./service";

export interface ArtifactTool {
    run(args: string[]): Promise<void>;
    copy(source: string, destination: string, parallelism: number, file?: string): Promise<void>;
}

export async function validateExecutable(executable: string): Promise<string> {
    if (!path.isAbsolute(executable) || /\.(cmd|bat|ps1|dll)$/i.test(executable)) {
        throw new Error("artifactToolPath must be an absolute native executable path, not a script or DLL.");
    }
    const stat = await fs.lstat(executable);
    if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error("artifactToolPath must be a regular trusted executable file.");
    }
    await fs.access(executable, process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
    return executable;
}

export async function executeProcess(
    executable: string, args: string[], env: NodeJS.ProcessEnv, signal: AbortSignal,
    log: (line: string) => void = line => console.log(`artifacttool: ${line}`)
): Promise<number> {
    signal.throwIfAborted();
    return new Promise<number>((resolve, reject) => {
        const child = spawn(executable, args, { env, shell: false, windowsHide: true, signal, stdio: ["ignore", "pipe", "pipe"] });
        const decoders = [new StringDecoder("utf8"), new StringDecoder("utf8")];
        const buffers = ["", ""];
        const flush = (index: number, text: string, final = false) => {
            buffers[index] += text;
            let newline: number;
            while ((newline = buffers[index].indexOf("\n")) >= 0) {
                log(buffers[index].slice(0, newline).replace(/\r$/, ""));
                buffers[index] = buffers[index].slice(newline + 1);
            }
            if (buffers[index].length > 65536 || final) {
                if (buffers[index]) {
                    log(buffers[index]);
                }
                buffers[index] = "";
            }
        };
        child.stdout.on("data", (data: Buffer) => flush(0, decoders[0].write(data)));
        child.stderr.on("data", (data: Buffer) => flush(1, decoders[1].write(data)));
        child.once("error", reject);
        child.once("close", (code, killedBy) => {
            flush(0, decoders[0].end(), true);
            flush(1, decoders[1].end(), true);
            if (signal.aborted || code === null) {
                reject(new Error(`Artifact subprocess was cancelled or terminated (${killedBy ?? "cancelled"}).`));
            } else {
                resolve(code);
            }
        });
    });
}

export function createArtifactTool(
    executable: string, serviceUrl: string, token: string, signal: AbortSignal
): ArtifactTool {
    validateServiceUrl(serviceUrl);
    if (!token) {
        throw new Error("The system job access token is missing.");
    }
    tl.setSecret(token);
    const tokenVariable = "PIPELINE_ARTIFACT_DEV_TOKEN";
    const env = { ...process.env, [tokenVariable]: token };
    return {
        async run(args) {
            const code = await executeProcess(executable,
                [...args, "--service", serviceUrl, "--patvar", tokenVariable], env, signal);
            if (code !== 0) {
                throw new Error(`ArtifactTool failed with exit code ${code}. See the prefixed tool diagnostics.`);
            }
        },
        async copy(source, destination, parallelism, file) {
            if (process.platform !== "win32") {
                throw new Error("Publishing to a file share is supported only on Windows.");
            }
            const args = [source, destination, file ?? "*", "/E", "/COPY:DA", "/NP", "/R:3", "/W:1", `/MT:${parallelism}`];
            const code = await executeProcess(tl.which("robocopy", true), args, process.env, signal);
            if (code > 7) {
                throw new Error(`File-share copy failed with robocopy exit code ${code}.`);
            }
        }
    };
}

export async function taskMain(manifest: string, action: (tool: ArtifactTool, serviceUrl: string, token: string, signal: AbortSignal) => Promise<void>): Promise<void> {
    tl.setResourcePath(manifest);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    try {
        tl.warning(tl.loc("DevelopmentOnly"));
        const executable = await validateExecutable(tl.getInputRequired("artifactToolPath"));
        const serviceUrl = tl.getEndpointUrlRequired("SYSTEMVSSCONNECTION");
        const token = tl.getEndpointAuthorizationParameterRequired("SYSTEMVSSCONNECTION", "AccessToken");
        const tool = createArtifactTool(executable, serviceUrl, token, controller.signal);
        await action(tool, serviceUrl, token, controller.signal);
        tl.setResult(tl.TaskResult.Succeeded, "Development artifact task completed.");
    } catch (error) {
        tl.setResult(controller.signal.aborted ? tl.TaskResult.Cancelled : tl.TaskResult.Failed,
            tl.loc("TaskFailed", error instanceof Error ? error.message : String(error)));
    } finally {
        process.removeListener("SIGINT", cancel);
        process.removeListener("SIGTERM", cancel);
    }
}
