
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

import path = require('path');

import unzip = require('./unzip');

import * as Util from './util';


var win = tl.osType().match(/^Win/);
tl.debug('win: ' + win);

// extractors
var xpUnzipLocation: string = win ? null : xpUnzipLocation = tl.which('unzip', false);
var winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

export function unzip(file: string, destinationFolder: string) {
    if (win) {
        sevenZipExtract(file, destinationFolder);
    } else {
        unzipExtract(file, destinationFolder);
    }
}

function unzipExtract(file: string, destinationFolder: string) {
    tl.debug('Extracting file: ' + file);
    if (typeof xpUnzipLocation == "undefined") {
        xpUnzipLocation = tl.which('unzip', true);
    }
    var unzip = tl.tool(xpUnzipLocation);
    unzip.arg(file);
    unzip.arg('-d');
    unzip.arg(destinationFolder);

    return handleExecResult(unzip.execSync(getOptions()), file);
}

function sevenZipExtract(file: string, destinationFolder: string) {
    tl.debug('Extracting file: ' + file);
    var sevenZip = tl.tool(winSevenZipLocation);
    sevenZip.arg('x');
    sevenZip.arg('-o' + destinationFolder);
    sevenZip.arg(file);
    return handleExecResult(sevenZip.execSync(getOptions()), file);
}

function handleExecResult(execResult: tr.IExecResult, file: string) {
    if (execResult.code != tl.TaskResult.Succeeded) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        var message = 'Extraction failed for file: ' + file +
            '\ncode: ' + execResult.code +
            '\nstdout: ' + execResult.stdout +
            '\nstderr: ' + execResult.stderr +
            '\nerror: ' + execResult.error;
        throw new UnzipError(message);
    }
}

function getOptions(): tr.IExecOptions {
    var execOptions: tr.IExecOptions = <any>{
        silent: true,
        outStream: new Util.StringWritable({ decodeStrings: false }),
        errStream: new Util.StringWritable({ decodeStrings: false }),
    };
    return execOptions;
}

export class UnzipError extends Error {
}