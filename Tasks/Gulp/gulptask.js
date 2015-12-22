/// <reference path="../../definitions/vso-task-lib.d.ts" />
var path = require('path');
var tl = require('vso-task-lib/vsotask');
tl.setResourcePath(path.join(__dirname, 'task.json'));
var gulpFile = tl.getPathInput('gulpFile', true, true);
var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);
var gulp = tl.which('gulp', false);
tl.debug('check path : ' + gulp);
if (!tl.exist(gulp)) {
    var gt = tl.createToolRunner(tl.which('node', true));
    var gulpjs = tl.getInput('gulpjs', true);
    gulpjs = path.join(cwd, gulpjs);
    tl.debug('check path : ' + gulpjs);
    if (!tl.exist(gulpjs)) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('GulpNotInstalled', gulpjs));
    }
    gt.arg(gulpjs);
}
else {
    var gt = tl.createToolRunner(gulp);
}
// optional - no tasks will concat nothing
gt.arg(tl.getInput('targets', false));
gt.arg('--gulpfile');
gt.arg(gulpFile);
gt.arg(tl.getInput('arguments', false));
gt.exec()
    .then(function (code) {
    tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
})
    .fail(function (err) {
    tl.debug('taskRunner fail');
    tl.setResult(tl.TaskResult.Failed, tl.loc('GulpFailed', err.message));
});
