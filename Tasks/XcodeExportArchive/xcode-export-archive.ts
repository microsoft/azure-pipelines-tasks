/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');
var execSync = require('child_process').execSync;

// if output is rooted ($(build.buildDirectory)/output/...), will resolve to fully qualified path,
// else relative to repo root
var buildSourceDirectory = tl.getVariable('build.sourceDirectory') || tl.getVariable('build.sourcesDirectory');
var out = path.resolve(buildSourceDirectory, tl.getInput('outputPattern', true));
var appPath = tl.getInput("appPath", true);
var appName = tl.getInput("appName", true);
var ipaName = tl.getInput("ipaName", true);
var provisioningProfile = tl.getInput("provisioningProfile", false);
var sdk = tl.getInput("sdk", true);
var optionsPlist = tl.getInput("exportOptionsPlist", true);

var xcodeBuild = tl.which("xcodebuild", true);
var cleanCommand = tl.createToolRunner(xcodeBuild);
var packageCommand = tl.createToolRunner(xcodeBuild);

//creates the dir if it's not there; note that this needs to be an absolute path for the .ipa to be generated.
var ipaPath = tl.getInput('ipaPath', true);
tl.mkdirP(path.join(buildSourceDirectory, ipaPath));

var xCode7Plus = false;
try {
    var version = parseInt(execSync("xcodebuild -version").toString().match(/\d+(?=\.\d+)/g));
    xCode7Plus = version >= 7;
} catch (e) {
    // The only reason for this to fail is if the call to xcodebuild fails, which means we aren't xcode 7+.
    tl.setResult(1, "xcodebuild command wasn't found. Are the xcode build tools installed on the agent?");
}

if (!xCode7Plus) {
    console.warn("Xcode <7 detected. The Xcode Package iOS task should be used instead of this one.");
}

var cleanCommandArgs = ["clean", "archive", "-archivePath", path.join(buildSourceDirectory, appPath, appName), "-scheme", appName];
cleanCommand.arg(cleanCommandArgs);

var packageCommandArgs = ["-sdk", sdk, "-exportArchive", "-exportOptionsPlist", optionsPlist, "-exportFormat", "ipa", "-archivePath", path.join(buildSourceDirectory, appPath, appName), "-exportPath", path.join(buildSourceDirectory, ipaName)];

if (provisioningProfile) {
    packageCommandArgs.push("-exportProvisioningProfile");
    packageCommandArgs.push(provisioningProfile);
}

packageCommand.arg(packageCommandArgs);

cleanCommand.exec().then((exitCode: number) => {
    return packageCommand.exec();
}).then((exitCode: number) => {
    tl.setResult(exitCode, "Task exited with code " + exitCode);
}).fail((err: any) => {
    tl.error(err);
    tl.debug("Task Failed");
    tl.debug(err);
    tl.setResult(1, "Task Failed. Check logs for more information");
});
