/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var gulpFile = tl.getPathInput('gulpFile', true, true);

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var gulp = tl.which('gulp', false);

tl.debug('check path : ' + gulp);
if(!tl.exist(gulp)) {
	tl.debug('not found global installed gulp, try to find gulp locally.');
	var gt = tl.createToolRunner(tl.which('node', true));

	var gulpjs = tl.getInput('gulpjs', true);
	gulpjs = path.resolve(cwd, gulpjs);

	tl.debug('check path : ' + gulpjs);
	if(!tl.exist(gulpjs)) {
		tl.setResult(tl.TaskResult.Failed, tl.loc('GulpNotInstalled', gulpjs));
	}

	gt.pathArg(gulpjs);
}
else {
	var gt = tl.createToolRunner(gulp);
	gt.arg('--no-color');
}

// optional - no tasks will concat nothing
tl.getDelimitedInput('targets', ' ', false)
	.forEach(x => {
		// omit empty values
		if (x) {
			gt.arg(x);
		}
	});

gt.arg('--gulpfile');

gt.pathArg(gulpFile);

gt.argString(tl.getInput('arguments', false));

gt.exec()
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('GulpReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('GulpFailed', err.message));
})