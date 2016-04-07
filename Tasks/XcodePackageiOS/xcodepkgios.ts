/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
var execSync = require('child_process').execSync;

var sourceDir = tl.getVariable('build.sourcesDirectory');

var tool = tl.which('xcrun', true);
var xcv = tl.createToolRunner(tool);
xcv.arg('--version');

//creates the dir if it's not there; note that this needs to be an absolute path for the .ipa to be generated.
var ipaPath = tl.getInput('ipaPath', true);
tl.mkdirP(path.join(sourceDir, ipaPath));

var xCode7Plus = false;
try {
    var version = parseInt(execSync('xcodebuild -version').toString().match(/\d+(?=\.\d+)/g));
    xCode7Plus = version >= 7;
} catch (e) {
    // The only reason for this to fail is if the call to xcodebuild fails, which means we aren't xcode 7+, which is ok
}

if (xCode7Plus) {
    console.warn("Xcode 7+ detected. The Xcode Export Archive task should be used instead of this one.");
}

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
