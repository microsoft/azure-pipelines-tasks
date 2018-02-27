"use strict";

import * as del from "del";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "vsts-task-lib/task";

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