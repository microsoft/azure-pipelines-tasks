var gulp = require('gulp');
var plugin_error = require('plugin-error');
var child_process = require('child_process');
var process = require('process');

function make (target, cb) {
    var cl = ('node make.js ' + target + ' ' + process.argv.slice(3).join(' ')).trim();
    console.log('------------------------------------------------------------');
    console.log('> ' + cl);
    console.log('------------------------------------------------------------');
    try {
        child_process.execSync(cl, { cwd: __dirname, stdio: 'inherit' });
    }
    catch (err) {
        var msg = err.output ? err.output.toString() : err.message;
        console.error(msg);
        cb(new plugin_error(msg));
        return false;
    }

    return true;
}

gulp.task('build', function (cb) {
    make('build', cb);
    cb();
});

gulp.task('default', (done) => (gulp.series('build')(done)));

gulp.task('test', function (cb) {
    make('test', cb);
    make('testLegacy', cb);
    cb();
});

gulp.task('package', function (cb) {
    var publish = process.argv.filter(function (arg) { return arg == '--server' }).length > 0;
    make('build', cb) &&
    make('package', cb) &&
    make('test', cb) &&
    make('testLegacy', cb) &&
    publish &&
    make('publish', cb);
    cb();
});
