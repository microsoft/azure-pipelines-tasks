/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import fs = require('fs');
import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import Q = require('q');
var xcutils = require('./xcode-task-utils.js');

// Get build inputs
var solutionPath = tl.getPathInput('solution', true, true);
var configuration = tl.getInput('configuration', true);
var args = tl.getInput('args');
var packageApp = tl.getBoolInput('packageApp');
var buildForSimulator = tl.getBoolInput('forSimulator');
var device = (buildForSimulator) ? 'iPhoneSimulator' : 'iPhone';
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

//Process working directory
var buildSourceDirectory = tl.getVariable('build.sourceDirectory') || tl.getVariable('build.sourcesDirectory');
var cwd = tl.getInput('cwd') || buildSourceDirectory;
tl.cd(cwd);

// Prepare function for tool execution failure
var onFailedExecution = function (err) {
    // Error executing
    tl.debug('ToolRunner execution failure: ' + err);
    tl.error('See http://go.microsoft.com/fwlink/?LinkId=760847');
    tl.exit(1);
}
var deleteKeychain:trm.ToolRunner = null;
var deleteProvProfile:trm.ToolRunner = null;
var provProfileUUID = null;
var signIdentity = null;

function iosIdentity() {

    var input = {
        cwd: cwd,
        unlockDefaultKeychain: tl.getBoolInput('unlockDefaultKeychain', false),
        defaultKeychainPassword: tl.getInput('defaultKeychainPassword', false),
        p12: tl.getPathInput('p12', false, false),
        p12pwd: tl.getInput('p12pwd', false),
        iosSigningIdentity: tl.getInput('iosSigningIdentity', false)
    }

    return xcutils.determineIdentity(input)
        .then(function (result:any) {
            if (result.identity) {
                tl.debug('found identity = ' + result.identity);
                signIdentity = result.identity;
            } else {
                tl.debug('No explicit signing identity specified in task.')
            }
            if (result.keychain) {
                tl.debug('Found keychaiin = ' + result.keychain);
            }
            tl.debug('deleteKeychain = ' + result.deleteCommand);
            deleteKeychain = result.deleteCommand;
        });
}


function iosProfile() {
    var input = {
        cwd: cwd,
        provProfileUuid: tl.getInput('provProfileUuid', false),
        provProfilePath: tl.getPathInput('provProfile', false),
        removeProfile: tl.getBoolInput('removeProfile', false)
    }

    return xcutils.determineProfile(input)
        .then(function (result:any) {
            if (result.uuid) {
                tl.debug('PROVISIONING_PROFILE=' + result.uuid);
                provProfileUUID = result.uuid;
            }
            tl.debug('deleteProvProfile = ' + result.deleteCommand);
            deleteProvProfile = result.deleteCommand;
        });
}

function processSigningInputs() {
    return iosIdentity().then(iosProfile);
}

// Restore NuGet packages of the solution
var nugetRunner = tl.createToolRunner(nugetPath);
nugetRunner.arg('restore');
nugetRunner.pathArg(solutionPath);
nugetRunner.exec()
    .then(function (code) {
        processSigningInputs()
            .then(function (code) {
                // Prepare build command line
                var xbuildRunner = tl.createToolRunner(xbuildToolPath);
                xbuildRunner.pathArg(solutionPath);
                if (configuration) {
                    xbuildRunner.arg('/p:Configuration=' + configuration);
                }
                if (device) {
                    xbuildRunner.arg('/p:Platform=' + device);
                }
                if (packageApp) {
                    xbuildRunner.arg('/p:BuildIpa=true');
                }
                if (args) {
                    xbuildRunner.argString(args);
                }
                if (provProfileUUID) {
                    xbuildRunner.arg('/p:CodesignProvision=' + provProfileUUID);
                }
                if (signIdentity) {
                    xbuildRunner.arg('/p:Codesignkey=' + signIdentity);
                }
                // Execute build
                xbuildRunner.exec()
                    .fin(function () {
                        tl.debug('deleteKeychain = ' + deleteKeychain);
                        tl.debug('deleteProvProfile = ' + deleteProvProfile);
                        if (deleteKeychain) {
                            tl.debug('Delete keychain');
                            deleteKeychain.exec(null)
                                .then(function (code) {
                                    if (deleteProvProfile) {
                                        tl.debug('Delete provisioning profile');
                                        deleteProvProfile.exec(null)
                                            .then(function (code) {
                                                tl.exit(code);
                                            })
                                    }
                                })
                        }
                    })
                    .fail(onFailedExecution) //xbuild
            })
            .fail(onFailedExecution) //process signing inputs
    })
    .fail(onFailedExecution) //NuGet