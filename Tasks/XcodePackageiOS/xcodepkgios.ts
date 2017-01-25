import tl = require('vsts-task-lib/task');
import path = require('path');

var sourceDir = tl.getVariable('System.DefaultWorkingDirectory');

var tool = tl.which('xcrun', true);
var xcv = tl.createToolRunner(tool);
xcv.arg('--version');

//creates the dir if it's not there; note that this needs to be an absolute path for the .ipa to be generated.
var ipaPath = tl.getInput('ipaPath', true);
tl.mkdirP(path.join(sourceDir, ipaPath));

//
// xcrun -sdk $sdk PackageApplication -v "$sourceDir/$appPath/$appFilename" -o "$sourceDir/$ipaPath/$ipaFilename" -embed '$provProfile'
//
var xcrun = tl.createToolRunner(tool);
xcrun.arg('-sdk');
xcrun.arg(tl.getInput('sdk', true));
xcrun.arg('PackageApplication');
xcrun.arg('-v');
xcrun.pathArg(path.join(sourceDir, tl.getInput('appPath', true), tl.getInput('appName', true)));
xcrun.arg('-o');
xcrun.pathArg(path.join(sourceDir, ipaPath, tl.getInput('ipaName', true)));
// TODO: consider --sign option
//xcrun.arg('--sign');
//xcrun.arg('iPhone Developer: Some Name (5CX2Y47E88)');
xcrun.arg('--embed');
xcrun.arg(tl.getInput('provisioningProfile', true));

xcv.exec()
.then(function(code) {
	return xcrun.exec();
})
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	console.error(err.message);
	tl.debug('taskRunner fail');
	tl.exit(1);
})
