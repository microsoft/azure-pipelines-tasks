var path = require('path');
var tl = require('vso-task-lib');

var gt = new tl.ToolRunner(tl.which('grunt', true));

// optional - no tasks will concat nothing
gt.arg(tl.getDelimitedInput('targets', ' ', false));

gt.arg('--gruntfile');
var gulpFile = tl.getPathInput('gruntFile', true);
gt.arg(gulpFile);

gt.arg(tl.getDelimitedInput('arguments', ' ', false));

var cwd = tl.getInput('cwd', false);
if (!cwd) {
	cwd = path.dirname(gulpFile);
}
tl.cd(cwd);

gt.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
