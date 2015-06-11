var path = require('path');
var tl = require('vso-task-lib');

var bash = new tl.ToolRunner(tl.which('bash', true));

var scriptPath = tl.getPathInput('scriptPath', true);
bash.arg(scriptPath);

bash.arg(tl.getDelimitedInput('args', ' ', false));

var failOnStdErr = tl.getInput('failOnStandardError') == 'true';

var cwd = tl.getPathInput('cwd', false);
if (!cwd) {
	cwd = path.dirname(scriptPath);
}
tl.cd(cwd);

bash.exec({ failOnStdErr: failOnStdErr})
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
