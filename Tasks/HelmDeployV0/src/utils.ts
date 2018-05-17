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

export function resolvePath(path : string): string {
    if (path.indexOf('*') >= 0 || path.indexOf('?') >= 0) {
        tl.debug(tl.loc('PatternFoundInPath', path));
        var rootFolder = tl.getVariable('System.DefaultWorkingDirectory');
        var allPaths = tl.find(rootFolder);
        var matchingResultsFiles = tl.match(allPaths, path, rootFolder, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(tl.loc('CantResolvePatternInPath', path));
        }

        return matchingResultsFiles[0];
    }
    else
    {
        tl.debug(tl.loc('PatternNotFoundInFilePath', path));
        return path;
    }
}

function ensureDirExists(dirPath : string) : void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}