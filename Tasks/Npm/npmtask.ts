/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var npm = tl.createToolRunner(tl.which('npm', true));

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var command = tl.getInput('command', true);
if (command.indexOf(' ') >= 0) {
	tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidCommand"));
}
npm.arg(command);

npm.argString(tl.getInput('arguments', false));

npm.exec()
.then(function(code) {
	tl.setResult(code, tl.loc('NpmReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
})