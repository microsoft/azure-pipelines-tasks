"use strict";

import { Writable } from "stream";
import { StringDecoder } from "string_decoder";
import * as tr from "azure-pipelines-task-lib/toolrunner";

// Matches one or more '#' followed by "vso[" - the prefix the Azure Pipelines agent
// uses to detect logging commands in task output. Matching #+ (not just ##) ensures
// inputs like "####vso[" are fully neutralized in a single pass rather than leaving
// a residual "##vso[" after replacing only the inner match. Case-insensitive because
// the agent accepts any casing.
const vsoCommandPattern = /#+vso\[/gi;

// Matches a trailing suffix that could be the START of a #+vso[ sequence split
// across separate output chunks (e.g. process output delivered in pipe-buffer sized
// pieces). These bytes are carried over to the next chunk instead of being written,
// so a marker split across a chunk boundary can still be detected and neutralized
// once it is complete.
const trailingPartialMarker = /#+(?:v(?:s(?:o(?:\[)?)?)?)?$/i;

/**
 * Unconditionally neutralizes "##vso[" command markers from untrusted process
 * output (for example Docker build/run/push output, which can contain
 * attacker-controlled content from a Dockerfile or docker-compose file in a pull
 * request) so the Azure Pipelines agent does not interpret it as a logging command
 * such as task.setvariable or artifact.upload.
 *
 * Docker/docker-compose output is not a channel that legitimately emits pipeline
 * logging commands (unlike, e.g., output from a user-authored remote script), so -
 * matching the precedent already shipped for Docker@2 (docker-common@2.276.0,
 * MSRC 122404 / ICM 31000000641377) - every "##vso[" marker is neutralized
 * regardless of which command it names. The replacement keeps the text readable in
 * the build log while making it invisible to the agent's command parser.
 */
export function sanitizeVsoCommands(data: string): string {
    return data.replace(vsoCommandPattern, (fullMatch: string) => "#" + fullMatch.slice(-4));
}

/**
 * Creates a Writable stream that sanitizes "##vso[" commands before forwarding
 * data to the given destination stream (normally process.stdout/process.stderr).
 * Intended for use as the outStream/errStream option of ToolRunner.exec()/
 * ContainerConnection.execCommand() so command output remains visible in the
 * build log but cannot be used to inject agent commands.
 *
 * The stream is stateful: it buffers any trailing characters that could be the
 * start of a "#+vso[" token split across chunk boundaries, and uses a StringDecoder
 * so multi-byte UTF-8 sequences split across chunks decode correctly.
 */
export function createSanitizedOutputStream(destination: NodeJS.WritableStream): Writable {
    const decoder = new StringDecoder("utf8");
    let pending = "";

    return new Writable({
        write(chunk: any, _encoding: string, callback: (error?: Error | null) => void) {
            const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
            pending += text;

            const tailMatch = trailingPartialMarker.exec(pending);
            const safeEnd = tailMatch ? tailMatch.index : pending.length;
            const toWrite = pending.substring(0, safeEnd);
            pending = pending.substring(safeEnd);

            if (toWrite) {
                destination.write(sanitizeVsoCommands(toWrite), "utf8", callback);
            } else {
                callback();
            }
        },
        final(callback: (error?: Error | null) => void) {
            pending += decoder.end();
            if (pending) {
                destination.write(sanitizeVsoCommands(pending), "utf8", callback);
            } else {
                callback();
            }
        }
    });
}

/**
 * Creates fresh exec options for a single docker/docker-compose invocation whose
 * stdout/stderr must be treated as untrusted (i.e. can contain attacker-controlled
 * content, such as Dockerfile RUN output echoed by `docker build`). Each call
 * returns new stream instances so carry-over buffers from one command don't leak
 * into the next.
 */
export function createSanitizedExecOptions(): tr.IExecOptions {
    return {
        outStream: createSanitizedOutputStream(process.stdout),
        errStream: createSanitizedOutputStream(process.stderr)
    } as tr.IExecOptions;
}
