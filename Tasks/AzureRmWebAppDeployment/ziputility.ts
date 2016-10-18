import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');

var gulp = require('gulp');
var zip = require('gulp-zip');
var DecompressZip = require('decompress-zip');

export function unzip(zipLocation, unzipLocation) {
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
        defer.resolve(unzipLocation);
    });
    unzipper.extract({
      path: unzipLocation
    });
    return defer.promise;
}

export function archiveFolder(folderPath, targetPath, zipName) {
    var defer = Q.defer();
    tl.debug('Archiving ' + folderPath + ' to ' + zipName);
     gulp.src(path.join(folderPath, '**', '*'),
      {
        dot: true
      })
      .pipe(zip(zipName))
      .pipe(gulp.dest(targetPath)).on('end', function(error){
         if(error) {
            defer.reject(error);
         }
        defer.resolve(path.join(targetPath, zipName));
      });
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
        var pacakgeComponent = {
            "entries":files
        };
        deferred.resolve(pacakgeComponent); 
    });
    unzipper.list();
    return deferred.promise;
}

