var fs = require('fs');
var path = require('path');
var tl = require('vsts-task-lib');

var gruntFile = tl.getPathInput('gruntFile', true);
var cwd = tl.getInput('cwd', false);
if (!cwd) {
	cwd = path.dirname(gruntFile);
}
tl.cd(cwd);

var grunt = tl.which('grunt', false);

tl.debug('check path : ' + grunt);
if(!grunt || !fs.existsSync(grunt)) {
	var gt = new tl.ToolRunner(tl.which('node', true));	
	var gtcli = path.resolve(cwd, 'node_modules/grunt-cli/bin/grunt');
	
	tl.debug('check path : ' + gtcli);
	if(!fs.existsSync(gtcli)) {
		tl.error('grunt-cli is not installed globally (or is not in the path of the user the agent is running as) and it is not in the local working folder: ' + gtcli);
		tl.exit(1);
		process.exit(0);
	}
	
	gt.arg(gtcli);
}
else {
	var gt = new tl.ToolRunner(grunt);
}

// optional - no tasks will concat nothing
gt.arg(tl.getDelimitedInput('targets', ' ', false));

gt.arg('--gruntfile');

gt.arg(gruntFile);

gt.arg(tl.getDelimitedInput('arguments', ' ', false));

gt.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
