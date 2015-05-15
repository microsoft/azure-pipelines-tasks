var path = require('path');
var tl = require('vso-task-lib');

var gt = new tl.ToolRunner(tl.which('gulp', true));

// optional - no tasks will concat nothing
gt.arg(tl.getDelimitedInput('targets', ' ', false));

gt.arg('--gulpfile');
var gulpFile = tl.getPathInput('gulpFile', true);
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
