"use strict";

var path    = require('path');
import * as tl from "vsts-task-lib/task";
import * as trm from 'vsts-task-lib/toolrunner';

var rootFolder: string;
var files: string[] = [];

// archivers
var xpTarLocation: string;
var xpZipLocation: string;
// 7zip
var xpSevenZipLocation: string;
var winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

export function createArchive(sourceFolder: string, archiveType: string, archiveFile: string) {

    rootFolder = path.dirname(archiveFile);
    files = tl.findMatch(sourceFolder, "**/*.*");

    if (tl.osType().match(/^Win/)) { // windows only
        var sourcePath = sourceFolder + "/*";
        if (archiveType == "zip") {
            sevenZipArchive(archiveFile, "zip", [sourcePath]);
        } else if (archiveType == "targz") {
                var tarFile = archiveFile.substring(0, archiveFile.lastIndexOf('.'));
                try {
                    // create the tar file
                    sevenZipArchive(tarFile, "tar", [sourcePath]);
                    // compress the tar file
                    sevenZipArchive(archiveFile, "gzip", [tarFile]);
                } finally {
                        tl.rmRF(tarFile);
                }
        }
    } else { // not windows
        if (archiveType == "zip") {
            zipArchive(archiveFile, files);
        } else if (archiveType == "targz") {

            tarArchive(archiveFile, "gz", files);
        }
    }
}

function getOptions() {
        //tl.debug("cwd (exclude root folder)= " + rootFolder);
        //return <trm.IExecOptions>{ cwd: rootFolder };
        return <trm.IExecOptions>{};
}

function getSevenZipLocation(): string {
    if (tl.osType().match(/^Win/)) {
        return winSevenZipLocation;
    } else {
        if (typeof xpTarLocation == "undefined") {
            xpSevenZipLocation = tl.which('7z', true);
        }
        return xpSevenZipLocation;
    }
}

function sevenZipArchive(archive: string, compression: string, files: string[]) {
    tl.debug('Creating archive with 7-zip: ' + archive);
    var sevenZip = tl.tool(getSevenZipLocation());
    sevenZip.arg('a');
    sevenZip.arg('-t' + compression);
    sevenZip.arg(archive);
    for (var i = 0; i < files.length; i++) {
        sevenZip.arg(files[i]);
    }
    return handleExecResult(sevenZip.execSync(getOptions()), archive);
}

// linux & mac only
function zipArchive(archive: string, files: string[]) {
    tl.debug('Creating archive with zip: ' + archive);
    if (typeof xpZipLocation == "undefined") {
        xpZipLocation = tl.which('zip', true);
    }
    var zip = tl.tool(xpZipLocation);
    zip.arg('-r');
    zip.arg(archive);
    for (var i = 0; i < files.length; i++) {
        zip.arg(files[i]);
        console.log(tl.loc('Filename', files[i]));
    }
    return handleExecResult(zip.execSync(getOptions()), archive);
}

// linux & mac only
function tarArchive(archive: string, compression: string, files: string[]) {
    tl.debug('Creating archive with tar: ' + archive + ' using compression: ' + compression);
    if (typeof xpTarLocation == "undefined") {
        xpTarLocation = tl.which('tar', true);
    }
    var tar = tl.tool(xpTarLocation);
    if (tl.exist(archive)) {
        tar.arg('-r'); // append files to existing tar
    } else {
        tar.arg('-c'); // create new tar otherwise
    }
    if (compression) {
        tar.arg('--' + compression);
    }
    tar.arg('-f');
    tar.arg(archive);
    for (var i = 0; i < files.length; i++) {
        tar.arg(files[i]);
    }
    return handleExecResult(tar.execSync(getOptions()), archive);
}

function handleExecResult(execResult, archive) {
    if (execResult.code != tl.TaskResult.Succeeded) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        throw(tl.loc('ArchiveCreationFailedWithError', archive, execResult.code, execResult.stdout, execResult.stderr, execResult.error));
    }
}