/// <reference path="../../definitions/vsts-task-lib.d.ts" />
var path = require('path');
var tl = require('vsts-task-lib/vsotask');
var nt = tl.createToolRunner(tl.which('node', true));
var gulpFile = tl.getPathInput('gulpFile', true);
var cwd = tl.getInput('cwd', false);
if (!cwd) {
    cwd = path.dirname(gulpFile);
}
var gulpjs = tl.getInput('gulpjs', true);
tl.debug('check path : ' + gulpjs);
tl.checkPath(gulpjs, 'gulpjs');
nt.arg(gulpjs);
// optional - no tasks will concat nothing
nt.arg(tl.getDelimitedInput('targets', ' ', false));
nt.arg('--gulpfile');
nt.arg(gulpFile);
nt.arg(tl.getDelimitedInput('arguments', ' ', false));
tl.cd(cwd);
nt.exec(null)
    .fail(function (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
});
