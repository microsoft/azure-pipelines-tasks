"use strict";

var fs      = require('fs');
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as os from "os";

export function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function getTaskTempDir(): string {
    var userDir = path.join(getTempDirectory(), "helmTask");
    ensureDirExists(userDir);

    userDir = path.join(userDir, getCurrentTime().toString());
    ensureDirExists(userDir);

    return userDir;
} 
export function deleteFile(filepath: string) : void {
    if(fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
}

function ensureDirExists(dirPath : string) : void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}