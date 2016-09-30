import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');

var admzip = require('adm-zip');
var gulp = require('gulp');
var zip = require('gulp-zip');

export function unzip(zipLocation, unzipLocation) {
    var unzipper = new admzip(zipLocation);
    tl.debug('extracting ' + zipLocation + ' to ' + unzipLocation);
    unzipper.extractAllTo(unzipLocation);
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
         if(error){
            defer.reject(error);
         }
        defer.resolve(path.join(targetPath, zipName));
      });
      return defer.promise;
}

