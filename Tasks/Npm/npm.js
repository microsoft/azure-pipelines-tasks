var path = require('path');
var tl = require('vsts-task-lib');

var npm = new tl.ToolRunner(tl.which('npm', true));

var command = tl.getInput('command', false) || 'install';
npm.arg(command);

npm.arg(tl.getDelimitedInput('arguments', ' ', false));

var cwd = tl.getInput('cwd', false);
if (cwd) {
	tl.cd(cwd);
}

npm.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
