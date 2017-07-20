"use strict";

var https   = require('https');
var fs      = require('fs');
var path    = require('path');

import * as tl from "vsts-task-lib/task";
import * as trm from 'vsts-task-lib/toolrunner';

export async function extractTar(file: string, destinationDir: string): Promise<void> {

    console.log(tl.loc('COMMON_ExtractingArchive'));

    let tr:trm.ToolRunner = tl.tool('tar');
    tr.arg(['xzC', destinationDir, '-f', file]);

    await tr.exec();
}

export async function extractZip(file: string, destinationDir: string): Promise<void> {
    if (!file) {
        throw new Error("parameter 'file' is required");
    }

    console.log(tl.loc('COMMON_ExtractingArchive'));
    if (process.platform == 'win32') {
        // build the powershell command
        let escapedFile = file.replace(/'/g, "''").replace(/"|\n|\r/g, ''); // double-up single quotes, remove double quotes and newlines
        let escapedDest = destinationDir.replace(/'/g, "''").replace(/"|\n|\r/g, '');
        let command: string = `$ErrorActionPreference = 'Stop' ; try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}')`;

        // change the console output code page to UTF-8.
        // TODO: FIX WHICH: let chcpPath = tl.which('chcp.com', true);
        let chcpPath = path.join(process.env.windir, "system32", "chcp.com");
        await tl.exec(chcpPath, '65001');

        // run powershell
        let powershell: trm.ToolRunner = tl.tool('powershell')
            .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
            .arg(command);
        await powershell.exec();
    }
    else {
        let unzip: trm.ToolRunner = tl.tool('unzip')
            .arg(file);
        await unzip.exec(<trm.IExecOptions>{ cwd: destinationDir });
    }
}