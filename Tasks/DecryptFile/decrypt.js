var fs = require('fs'),
	tl = require('vso-task-lib');

//Process working directory
var cwd = tl.getInput('cwd') || tl.getVariable('build.sourceDirectory') || tl.getVariable('build.sourcesDirectory');
tl.cd(cwd);

var tr = new tl.ToolRunner(tl.which('openssl', true));

tr.arg(tl.getInput('cipher', true))

var inFile = tl.getInput('inFile', true);
tr.arg(['-d', '-in', inFile]);

tr.arg('-out');
var outFile = tl.getPathInput('outFile', false);
if(fs.existsSync(outFile) && fs.lstatSync(outFile).isDirectory()) {
	tr.arg(inFile + '.out');
} else {
	tr.arg(outFile)	
}

tr.arg(['-pass','pass:' + tl.getInput('passphrase')])

tr.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	console.error(err.message);
	tl.debug('taskRunner fail');
	tl.exit(1);
})
