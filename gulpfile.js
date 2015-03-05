var gulp = require('gulp');
var path = require('path');
var del = require('del'); 
var shell = require('shelljs')
var pkgm = require('./package');
var runSequence = require('run-sequence');

var _packageRoot = path.join(__dirname, 'Package');

gulp.task('clean', function (cb) {
	del([_packageRoot],cb);
});

gulp.task('package', function () {
	shell.mkdir('-p', _packageRoot);
	return gulp.src(path.join(__dirname, 'Tasks', '**/task.json'))
        .pipe(pkgm.PackageTask(_packageRoot));
});

gulp.task('default', function(done) {
    runSequence('clean' 
    		   ,'package'
			   ,function(err) {
			   		if (err) {
			   			console.error('Build Failed');	
			   		}
			   });
});
