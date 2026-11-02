import stream = require("stream");
import { StringDecoder } from "string_decoder";

const LOG_COMMAND_PATTERN = /^(\s*)##(vso\[)/gim;

export function sanitizeLogCommands(text: string): string {
    if (!text) {
        return text;
    }

    return text.replace(LOG_COMMAND_PATTERN, "$1#_#$2");
}

/**
 * Sanitizes ##vso[ log commands before forwarding to the real stream.
 *
 * Child process stdout/stderr chunks arrive at arbitrary OS pipe boundaries and
 * are written to this stream one chunk at a time (ToolRunner does not line-buffer
 * before writing). A ##vso[ marker can therefore be split across two separate
 * _write() calls (e.g. "##vs" then "o[..."), and neither chunk alone would match
 * the sanitization pattern. To prevent this bypass, incomplete trailing lines are
 * held back until a newline completes them (or until flush() is called at the
 * end of the command), and only fully-received lines are sanitized and emitted.
 */
export class SanitizingWritable extends stream.Writable {
    private readonly decoder = new StringDecoder("utf8");
    private buffer: string = "";

    constructor(private readonly target: NodeJS.WritableStream) {
        super();
    }

    public _write(chunk: any, encoding: string, callback: (error?: Error) => void): void {
        try {
            const text = Buffer.isBuffer(chunk) ? this.decoder.write(chunk) : String(chunk);
            this.buffer += text;

            const lastNewline = this.buffer.lastIndexOf("\n");
            if (lastNewline === -1) {
                callback();
                return;
            }

            const completed = this.buffer.slice(0, lastNewline + 1);
            this.buffer = this.buffer.slice(lastNewline + 1);
            this.target.write(sanitizeLogCommands(completed));
            callback();
        } catch (err) {
            callback(err);
        }
    }

    public _final(callback: (error?: Error) => void): void {
        try {
            this.flush();
            callback();
        } catch (err) {
            callback(err);
        }
    }

    /** Flushes any buffered, not-yet-terminated trailing line. Safe to call multiple times. */
    public flush(): void {
        this.buffer += this.decoder.end();
        if (this.buffer.length > 0) {
            this.target.write(sanitizeLogCommands(this.buffer));
            this.buffer = "";
        }
    }
}
