/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var tool = tl.which(tl.getInput('filename', true), true);

var tr = tl.createToolRunner(tool);

var cwd = tl.getPathInput('workingFolder', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

tr.argString(tl.getInput('arguments', false));

var failOnStdErr = tl.getBoolInput('failOnStandardError', false);

tr.exec(<any>{failOnStdErr: failOnStdErr})
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('CmdLineReturnCode', tool, code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('CmdLineFailed', tool, err.message));
})
