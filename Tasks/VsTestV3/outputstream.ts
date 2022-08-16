import * as stream from 'stream';
import * as os from 'os';
import * as ci from './cieventlogger';
import * as tl from 'azure-pipelines-task-lib/task';

export class StringErrorWritable extends stream.Writable {
    private value: string = '';
    private isErrorStream: boolean;
    private isBlockingCommands: boolean;

    constructor(isErrorStream: boolean, isBlockingCommands: boolean, options: any) {
        super(options);
        this.isErrorStream = isErrorStream;
        this.isBlockingCommands = isBlockingCommands;
    }

    _write(data: any, encoding: string, callback: Function): void {
        this.value += data;

        let errorString: string = data.toString();
        let n = errorString.indexOf(os.EOL);
        while (n > -1) {
            var line = errorString.substring(0, n);

            if (this.isBlockingCommands) {
                var command = this.getCommand(line);
                if (command != null) {
                    const taskProps: { [key: string]: string; } = { command: command };
                    ci.publishEvent(taskProps);

                    const allowedCommands = ['task.logdetail', 'task.logissue', 'task.complete', 'task.setprogress',
                        'task.setsecret', 'task.setvariable', 'task.debug', 'task.settaskvariable', 'task.prependpath'];

                    if (allowedCommands.indexOf(command.toLowerCase()) < 0) {
                        line = line.replace('##vso', '#vso');
                    }
                }
            }

            if (this.isErrorStream) {
                tl.error(line);
            }
            else {
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

    getCommand(line: string): string {
        let startIndex = line.indexOf('##vso[') + 6;
        if (startIndex < 6) {
            return null;
        }

        let endIndex = line.indexOf(']', startIndex);
        if (endIndex < 0) {
            return null;
        }

        let endIndex2 = line.indexOf(' ', startIndex);
        if (endIndex2 < endIndex && endIndex2 > startIndex) {
            endIndex = endIndex2;
        }

        return line.substring(startIndex, endIndex);
    }
}