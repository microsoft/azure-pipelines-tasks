var gulp = require('gulp');
var path = require('path');
var del = require('del'); 
var shell = require('shelljs')
var pkgm = require('./package');

var _packageRoot = path.join(__dirname, 'Package', 'Tasks');

gulp.task('clean', function (cb) {
	del([_packageRoot],cb);
});

gulp.task('package', ['clean'], function () {
	shell.mkdir('-p', _packageRoot);
	return gulp.src(path.join(__dirname, 'Tasks', '**/task.json'))
        .pipe(pkgm.PackageTask(_packageRoot));
});

gulp.task('default', ['package']);
