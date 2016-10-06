import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');

var gulp = require('gulp');
var gulpZip = require('gulp-zip');
var admzip = require('adm-zip');

export function unzip(zipLocation : string, unzipLocation : string) {
	var unzipper = new admzip(zipLocation);
	unzipper.extractAllTo(unzipLocation);
}

export async function zip(webAppFolder:string) {
    var deferred = Q.defer<string>();
    var defaultWorkingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
    var tempPackageName = 'temp_web_app_package.zip';
    await gulp.src(path.join(webAppFolder, '**', '*'), {dot: true})
        .pipe(gulpZip(tempPackageName))
        .pipe(gulp.dest(defaultWorkingDirectory)).on('end',function(error){
            if(error){
                throw new Error(error);
            }
            deferred.resolve(path.join(defaultWorkingDirectory, tempPackageName));
        });
    return deferred.promise;
}