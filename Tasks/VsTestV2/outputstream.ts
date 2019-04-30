import * as stream from 'stream';
import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';

export class StringErrorWritable extends stream.Writable {
    private value: string = '';

    constructor(options: any) {
        super(options);
    }

    _write(data: any, encoding: string, callback: Function): void {
        this.value += data;

        let errorString: string = data.toString();
        let n = errorString.indexOf(os.EOL);
        while (n > -1) {
            const line = errorString.substring(0, n);
            tl.error(line);

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