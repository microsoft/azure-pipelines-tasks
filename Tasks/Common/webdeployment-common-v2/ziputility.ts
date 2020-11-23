import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import Q = require('q');
import fs = require('fs');
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

var DecompressZip = require('decompress-zip');
var archiver = require('archiver');

export async function unzip(zipFileLocation: string, unzipDirLocation: string) {
    if(tl.exist(unzipDirLocation)) {
        tl.rmRF(unzipDirLocation);
    }

    var isWin = tl.getPlatform() == tl.Platform.Windows
    tl.debug('win: ' + isWin);
    var unzipRunner: ToolRunner;
    if (isWin) {
        tl.debug('Using 7zip tool for extracting');
        var win7zipLocation = path.join(__dirname, '7zip/7z.exe');
        unzipRunner = tl.tool(win7zipLocation)
            .arg([ 'x', `-o${unzipDirLocation}`, zipFileLocation ]);
    } else {
        tl.debug('Using unzip tool for extracting');
        var unzipToolLocation = tl.which('unzip', true);
        unzipRunner = tl.tool(unzipToolLocation)
            .arg([ zipFileLocation, '-d', unzipDirLocation ]);
    }

    tl.debug('extracting ' + zipFileLocation + ' to ' + unzipDirLocation);
    await unzipRunner.exec();
    tl.debug('extracted ' + zipFileLocation + ' to ' + unzipDirLocation + ' Successfully');
}

export async function archiveFolder(folderPath, targetPath, zipName) {
    var defer = Q.defer();
    tl.debug('Archiving ' + folderPath + ' to ' + zipName);
    var outputZipPath = path.join(targetPath, zipName);
    var output = fs.createWriteStream(outputZipPath);
    var archive = archiver('zip');
    output.on('close', function () {
        tl.debug('Successfully created archive ' + zipName);
        defer.resolve(outputZipPath);
    });

    output.on('error', function(error) {
        defer.reject(error);
    });

    archive.pipe(output);
    archive.directory(folderPath, '/');
    archive.finalize();

    return defer.promise;
}

/**
 *  Returns array of files present in archived package
 */
export async function getArchivedEntries(archivedPackage: string)  {
    var deferred = Q.defer();
    var unzipper = new DecompressZip(archivedPackage);
    unzipper.on('error', function (error) {
        deferred.reject(error);
    });
    unzipper.on('list', function (files) {
        var packageComponent = {
            "entries":files
        };
        deferred.resolve(packageComponent); 
    });
    unzipper.list();
    return deferred.promise;
}

