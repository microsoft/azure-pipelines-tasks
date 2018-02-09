import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');
import fs = require('fs');

var DecompressZip = require('decompress-zip');
var archiver = require('archiver');

export async function unzip(zipLocation, unzipLocation) {
    var defer = Q.defer();
    if(tl.exist(unzipLocation)) {
      tl.rmRF(unzipLocation, false);
    }
    var unzipper = new DecompressZip(zipLocation);
    tl.debug('extracting ' + zipLocation + ' to ' + unzipLocation);
    unzipper.on('error', function (error) {
        defer.reject(error);
    });
    unzipper.on('extract', function (log) {
        tl.debug('extracted ' + zipLocation + ' to ' + unzipLocation + ' Successfully');
        defer.resolve(unzipLocation);
    });
    unzipper.extract({
      path: unzipLocation
    });
    return defer.promise;
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


export class ZipUtility {
    public static archive(folderPath: string, archivePath: string) {
        let filesToArchive: Array<string> = this.findFiles(folderPath);
        let isWindowsAgent: boolean = !!(tl.osType().match(/^Win/));
        let zipToolPath: string;
        let addtionalArguments: Array<string> = [];
        if(isWindowsAgent) {
            zipToolPath = path.join(__dirname, '7zip', '7zip.exe');
            addtionalArguments.concat(['a', '-tzip']);
        }
        else {
            zipToolPath = tl.which('zip', true);
            addtionalArguments.push('-r');
        }

        addtionalArguments.push(archivePath);
        addtionalArguments.concat(filesToArchive);
        let taskResult = tl.execSync(zipToolPath, addtionalArguments, <any> {
            silent: true,
            failOnStdErr: true,
            windowsVerbatimArguments: isWindowsAgent
        });

        if(taskResult.code != 0) {
            throw new Error(taskResult.error.toString());
        }
    }

    public static extract() {
        
    }

    private static findFiles(folderPath: string): Array<string> {
        let fullPaths: string[] = tl.ls('-A', [folderPath]);
        let baseNames: string[] = [];
        for(var fullPath of fullPaths) {
            baseNames.push(path.basename(fullPath));
        }

        tl.debug(`no. of files found: ${baseNames.length}`);
        return baseNames;
    }
}