var path = require('path');
var tl = require('vso-task-lib');

var npm = new tl.ToolRunner(tl.which('npm', true));

npm.arg('install');
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
