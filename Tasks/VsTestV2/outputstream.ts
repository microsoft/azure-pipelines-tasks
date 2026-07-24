import * as stream from 'stream';
import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';

export class StringErrorWritable extends stream.Writable {
    private value: string = '';
    private isErrorStream: boolean;

    constructor(isErrorStream: boolean, options: any) {
        super(options);
        this.isErrorStream = isErrorStream;
    }

    _write(data: any, encoding: string, callback: Function): void {
        this.value += data;

        let errorString: string = data.toString();
        let n = errorString.indexOf(os.EOL);
        while (n > -1) {
            // Neutralize all ##vso logging commands from vstest output to prevent
            // logging-command injection attacks (CWE-77). Test-authored output is
            // untrusted and must never reach the agent command parser unfiltered.
            let line = errorString.substring(0, n).replace(/##vso\[/gi, '#vso[');

            if (this.isErrorStream) {
                tl.error(line);
            } else {
                console.log(line);
            }

            // the rest of the string ...
            errorString = errorString.substring(n + os.EOL.length);
            n = errorString.indexOf(os.EOL);
        }
        if (callback) {
            callback();
        }
    }

    toString(): string {
        return this.value;
    }
}