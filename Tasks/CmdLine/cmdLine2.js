var path = require('path');
var tl = require('vso-task-lib');

var tool = tl.which(tl.getInput('filename', true), true);

var tr = new tl.ToolRunner(tool);
tr.arg(tl.getDelimitedInput('arguments', ' ', false));

var cwd = tl.getInput('workingFolder', false);
if (cwd) {
	tl.cd(cwd);
}

var failInput = tl.getInput('failOnStandardError');
var failOnStdErr = (failInput == 'true');

//tr.exec({failOnStdErr: failOnStdErr})
tr.exec()
.then(function(code) {
	console.log('code is: ' + code);
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
