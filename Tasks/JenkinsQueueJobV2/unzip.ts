// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

import path = require('path');

import * as Util from './util';

const win = tl.osType().match(/^Win/);
tl.debug('win: ' + win);

// extractors
let xpUnzipLocation: string = win ? null : tl.which('unzip', false);
let winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

export function unzip(file: string, destinationFolder: string): void {
    if (win) {
        sevenZipExtract(file, destinationFolder);
    } else {
        unzipExtract(file, destinationFolder);
    }
}

function unzipExtract(file: string, destinationFolder: string): void {
    tl.debug('Extracting file: ' + file);
    if (typeof xpUnzipLocation == 'undefined') {
        xpUnzipLocation = tl.which('unzip', true);
    }
    const unzip: tr.ToolRunner = tl.tool(xpUnzipLocation);
    unzip.arg(file);
    unzip.arg('-d');
    unzip.arg(destinationFolder);

    return handleExecResult(unzip.execSync(getOptions()), file);
}

function sevenZipExtract(file: string, destinationFolder: string): void {
    tl.debug('Extracting file: ' + file);
    const sevenZip: tr.ToolRunner  = tl.tool(winSevenZipLocation);
    sevenZip.arg('x');
    sevenZip.arg('-o' + destinationFolder);
    sevenZip.arg(file);
    return handleExecResult(sevenZip.execSync(getOptions()), file);
}

function handleExecResult(execResult: tr.IExecResult, file: string): void {
    if (execResult.code != tl.TaskResult.Succeeded) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        const message: string = 'Extraction failed for file: ' + file +
            '\ncode: ' + execResult.code +
            '\nstdout: ' + execResult.stdout +
            '\nstderr: ' + execResult.stderr +
            '\nerror: ' + execResult.error;
        throw new UnzipError(message);
    }
}

function getOptions(): tr.IExecOptions {
    const execOptions: tr.IExecOptions = <any> {
        silent: true,
        outStream: new Util.StringWritable({ decodeStrings: false }),
        errStream: new Util.StringWritable({ decodeStrings: false }),
    };
    return execOptions;
}

export class UnzipError extends Error {
}
