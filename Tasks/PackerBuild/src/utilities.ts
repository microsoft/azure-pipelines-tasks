"use strict";

import * as os from "os";
import * as path from "path";
import * as stream from "stream";
import * as tl from "vsts-task-lib/task";

export function copyFile(source: string, destination: string): void {
    tl.checkPath(source, tl.loc("CopySourceNotExists", source));

    if(!tl.exist(destination)) {
        console.log(tl.loc("CreatingDestinationDir", destination));
        tl.mkdirP(destination);
        console.log(tl.loc("CreatedDestinationDir", destination));        
    }

    tl.cp(source, destination, "-f")
}

export function getTempDirectory(): string {
    return os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function IsNullOrEmpty(str: string): boolean {
    if(str === null || str === undefined || str === "") {
        return true;
    }

    return false;
}

export function HasItems(arr: any[]): boolean {
    if(arr === null || arr === undefined || arr.length === 0) {
        return true;
    }

    return false;
}

// Extends stream.Writable to support parsing data as they are written
export class StringWritable extends stream.Writable {

    constructor(options, parserCallback?) {
        super(options);
        this._parserCallback = parserCallback;
    }

    _write(data: any, encoding: string, callback: Function): void {
        console.log(data);

        if(!!this._parserCallback) {
            this._parserCallback(data.toString());
        }

        if (callback) {
            callback();
        }
    }

    private _parserCallback: (line: string) => void;
};