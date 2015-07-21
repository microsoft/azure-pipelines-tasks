var path = require('path');
var tl = require('vso-task-lib');

var bash = new tl.ToolRunner(tl.which('bash', true));

var scriptPath = tl.getPathInput('scriptPath', true);
bash.arg(scriptPath);

bash.arg(tl.getInput('args', false));

var failOnStdErr = tl.getInput('failOnStandardError') == 'true';

var cwd = tl.getPathInput('cwd', false);
if (!cwd) {
	cwd = path.dirname(scriptPath);
}
tl.debug('using cwd: ' + cwd);
tl.cd(cwd);

bash.exec({ failOnStdErr: failOnStdErr})
.then(function(code) {
	// TODO: switch to setResult in the next couple of sprints
	tl.exit(code);
})
.fail(function(err) {
	console.error(err.message);
	tl.debug('taskRunner fail');
	tl.exit(1);
})
