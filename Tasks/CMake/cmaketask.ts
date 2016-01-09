/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var cmake = tl.createToolRunner(tl.which('cmake', true));

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

cmake.arg(tl.getInput('cmakeArgs', false));

cmake.exec()
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('CMakeReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('CMakeFailed', err.message));
})
