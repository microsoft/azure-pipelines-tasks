/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var gruntFile = tl.getPathInput('gruntFile', true, true);

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var grunt = tl.which('grunt', false);

tl.debug('check path : ' + grunt);
if(!tl.exist(grunt)) {
	tl.debug('not found global installed grunt-cli, try to find grunt-cli locally.');	
	var gt = tl.createToolRunner(tl.which('node', true));	
	
	var gtcli = tl.getInput('gruntCli', true);
	gtcli = path.resolve(cwd, gtcli);
	
	tl.debug('check path : ' + gtcli);
	if(!tl.exist(gtcli)) {
		tl.setResult(tl.TaskResult.Failed, tl.loc('GruntCliNotInstalled', gtcli));
	}
	
	gt.arg(gtcli);
}
else {
	var gt = tl.createToolRunner(grunt);
}

// optional - no tasks will concat nothing
gt.arg(tl.getInput('targets', false));

gt.arg('--gruntfile');

gt.arg(gruntFile);

gt.arg(tl.getInput('arguments', false));

gt.exec()
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('GruntReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('GruntFailed', err.message));
})