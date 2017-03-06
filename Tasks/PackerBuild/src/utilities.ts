"use strict";

import * as os from "os";
import * as path from "path";
import * as stream from "stream";
import * as tl from "vsts-task-lib/task";

// copy source file to destination folder. destination folder will be created if it does not exists, otherwise its contents will be overwritten.
export function copyFile(sourceFile: string, destinationFolder: string): void {
    tl.checkPath(sourceFile, tl.loc("CopySourceNotExists", sourceFile));

    if(!tl.exist(destinationFolder)) {
        console.log(tl.loc("CreatingDestinationDir", destinationFolder));
        tl.mkdirP(destinationFolder);
        console.log(tl.loc("CreatedDestinationDir", destinationFolder));        
    }

    tl.cp(sourceFile, destinationFolder, "-f")
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
        return false;
    }

    return true;
}

// Extends stream.Writable to support parsing data as they are written
export class StringWritable extends stream.Writable {

    constructor(options, parserCallback?) {
        super(options);
        this._parserCallback = parserCallback;
    }

    _write(data: any, encoding: string, callback: Function): void {
        console.log(data.toString());

        if(!!this._parserCallback) {
            this._parserCallback(data.toString());
        }

        if (callback) {
            callback();
        }
    }

    private _parserCallback: (line: string) => void;
};