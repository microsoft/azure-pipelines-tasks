/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var bash = tl.createToolRunner(tl.which('bash', true));

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var scriptPath = tl.getPathInput('scriptPath', true, true);
bash.pathArg(scriptPath);

bash.arg(tl.getInput('args', false));

var failOnStdErr = tl.getBoolInput('failOnStandardError', false);

bash.exec(<any>{failOnStdErr: failOnStdErr})
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('BashReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('BashFailed', err.message));
})