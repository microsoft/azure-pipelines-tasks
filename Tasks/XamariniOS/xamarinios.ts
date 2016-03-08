/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');

// Get configuration
var configuration = tl.getInput('configuration', true);
// Get and check path to solution file (.sln)
var solutionPath = tl.getPathInput('solution', true, true);
// Get whether to build for the iOS Simulator
var buildForSimulator = tl.getInput('forSimulator', false);
var device = (buildForSimulator == 'true') ? 'iPhoneSimulator' : 'iPhone';
tl.debug('Build for iOS Simulator: ' + buildForSimulator);
tl.debug('Device: ' + device);

// Get path to xbuild
var xbuildToolPath = tl.which('xbuild');
var xbuildLocation = tl.getInput('mdtoolLocation', false);
if (xbuildLocation) {
    xbuildToolPath = xbuildLocation + '/xbuild';
    tl.checkPath(xbuildToolPath, 'xbuild');
}
if (!xbuildToolPath) {
    tl.error('xbuild was not found in the path.');
    tl.exit(1);
}

// Find location of nuget
var nugetPath = tl.which('nuget');
if (!nugetPath) {
    tl.error('nuget was not found in the path.');
    tl.exit(1);
}

// Prepare function for tool execution failure
var onFailedExecution = function (err) {
    // Error executing
    console.error(err.message);
    tl.debug('ToolRunner execution failure: ' + err);
    tl.exit(1);
}

// Restore NuGet packages of the solution
var nugetRunner = tl.createToolRunner(nugetPath);
nugetRunner.arg('restore');
nugetRunner.pathArg(solutionPath);
nugetRunner.exec()
    .then(function (code) {

        // Prepare build command line
        var xbuildRunner = tl.createToolRunner(xbuildToolPath);
        xbuildRunner.pathArg(solutionPath);
        if (configuration) {
            xbuildRunner.arg('/p:Configuration=\"' + configuration + '\"');
        }
        if (device) {
            xbuildRunner.arg('/p:Platform=\"' + device + '\"');
        }
        // Execute build
        xbuildRunner.exec()
            .then(function (code) {
                // Executed successfully
                tl.exit(code);
            })
            .fail(onFailedExecution)
    })
    .fail(onFailedExecution)
