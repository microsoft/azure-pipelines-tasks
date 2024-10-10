import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import Q = require('q');
import fs = require('fs');
import StreamZip from 'node-stream-zip';
var archiver = require('archiver');

export async function unzip(zipLocation, unzipLocation) {
    var defer = Q.defer();
    if(tl.exist(unzipLocation)) {
      tl.rmRF(unzipLocation);
    }
    tl.mkdirP(unzipLocation);
    const zip = new StreamZip.async({ file: zipLocation});
        zip.extract(null, unzipLocation).then(() => {
            zip.close();
            defer.resolve();
        }).catch((error) => {
            console.log(`error extracting ${zipLocation}: ${error}`);
            defer.reject(error);
        })
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
    const zip = new StreamZip.async({file: archivedPackage});
    zip.entries().then(entries => {
        var packageConmponent = {
            'entries': Object.keys(entries)
        }
        zip.close();
        deferred.resolve(packageConmponent);
    }).catch(error => {
        deferred.reject(error);
    })
    return deferred.promise;
}

export function checkIfFilesExistsInZip(archivedPackage: string, files: string[]) {
    let deferred = Q.defer<boolean>();
    for(let i=0; i < files.length ; i++) {
        files[i] = files[i].toLowerCase();
    }

    const zip = new StreamZip({
        file: archivedPackage,
        storeEntries: true,
        skipEntryNameValidation: true
    });

    zip.on('ready', () => {
        let fileCount: number = 0;
        for (let entry in zip.entries()) {
            if(files.indexOf(entry.toLowerCase()) != -1) {
                fileCount += 1;
            }
        }

        zip.close();
        deferred.resolve(fileCount == files.length);
    });

    zip.on('error', error => {
        deferred.reject(error);
    });

    return deferred.promise;
}