"use strict";

import * as os from "os";
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

export class StringWritable extends stream.Writable {

    value: string = "";

    constructor(options, parserCallback?) {
        super(options);
        this._parserCallback = parserCallback;
    }

    _write(data: any, encoding: string, callback: Function): void {
        tl.debug(data);
        this.value += data;
        if(!!this._parserCallback) {
            this._parserCallback(data.toString());
        }

        if (callback) {
            callback();
        }
    }

    public clear(): void {
        this.value = "";
    }

    public toString(): string {
        return this.value;
    }

    private _parserCallback: (line: string) => void;
};