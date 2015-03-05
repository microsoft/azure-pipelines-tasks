var tl = require('vso-task-lib');

var gt = new tl.ToolRunner(tl.which('gulp', true));

// optional - no tasks will concat nothing
gt.arg(tl.getDelimitedInput('tasks', ' ', false));
gt.arg('--gulpfile');
gt.arg(tl.getInput('gulpFile', true));

gt.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
