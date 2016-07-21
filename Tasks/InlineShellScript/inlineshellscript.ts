/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
tl.setResourcePath(path.join( __dirname, 'task.json'));

var runner = tl.getInput('customTool', true);
var tool = tl.createToolRunner(tl.which(runner, true));
var content = tl.getInput('script');
var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);
var tempScript = cwd + "/inlineShellScript.sh";
 
fs.writeFileSync(tempScript,content,'utf8');
tool.pathArg(tempScript);

var failOnStdErr = tl.getBoolInput('failOnStandardError', false);

tool.exec(<any>{failOnStdErr: failOnStdErr})
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('BashReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('BashFailed', err.message));
})