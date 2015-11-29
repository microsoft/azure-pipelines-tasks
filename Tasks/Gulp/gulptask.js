var fs = require('fs');
var path = require('path');
var tl = require('vso-task-lib');

var nt = new tl.ToolRunner(tl.which('node', true));

var gulpFile = tl.getPathInput('gulpFile', true);
var cwd = tl.getInput('cwd', false);
if (!cwd) {
	cwd = path.dirname(gulpFile);
}

var gulpjs = path.resolve(cwd, tl.getInput('gulpjs', true));

tl.debug('check path : ' + gulpjs);
if(!fs.existsSync(gulpjs)){
	tl.exit(1);
	throw ('gulp.js doesn\'t exist at: ' + gulpjs);
}

nt.arg(gulpjs);

// optional - no tasks will concat nothing
nt.arg(tl.getDelimitedInput('targets', ' ', false));

nt.arg('--gulpfile');

nt.arg(gulpFile);

nt.arg(tl.getDelimitedInput('arguments', ' ', false));

tl.cd(cwd);

nt.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
