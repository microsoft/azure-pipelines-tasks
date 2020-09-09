"use strict";

import * as del from "del";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "azure-pipelines-task-lib/task";

// http://www.daveeddy.com/2013/03/26/synchronous-file-io-in-nodejs/
// We needed a true Sync file write for config file
export function writeFileSync(filePath: string, data: string): number {
    try
    {
        const fd = fs.openSync(filePath, 'w');
        var bitesWritten = fs.writeSync(fd, data);
        fs.fsyncSync(fd);
        tl.debug(tl.loc("FileContentSynced", data));
        fs.closeSync(fd);
        return bitesWritten;
    } catch(e)
    {
        tl.error(tl.loc('CantWriteDataToFile', filePath, e));
        throw e;
    }
}

export function findDockerFile(dockerfilepath: string) : string {
    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        let workingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
        let allFiles = tl.find(workingDirectory);
        let matchingResultsFiles = tl.match(allFiles, dockerfilepath, workingDirectory, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
        }

        return matchingResultsFiles[0];
    }
    else
    {
        tl.debug(tl.loc('ContainerPatternNotFound'));
        return dockerfilepath;
    }
}