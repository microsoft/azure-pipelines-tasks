var path = require('path');
var tl = require('vso-task-lib');

var cmake = new tl.ToolRunner(tl.which('cmake', true));

var args = tl.getInput('cmakeArgs', false) || tl.getInput('args', false);
cmake.arg(args);

var cwd = tl.getPathInput('cwd', false);

// will error and fail task if it doesn't exist
tl.checkPath(cwd, 'cwd');
tl.cd(cwd);

cmake.exec({ failOnStdErr: false})
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	console.error(err.message);
	tl.debug('taskRunner fail');
	tl.exit(1);
})
