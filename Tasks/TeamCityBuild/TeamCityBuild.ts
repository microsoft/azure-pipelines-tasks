/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));
var pyScript = 'TeamCityBuild.py';

var tr = tl.createToolRunner(tl.which('python', true));

var cwd = tl.getPathInput('workingFolder', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);
// Get TeamCity URL and credentials from endpoint 
var cred = tl.getPathInput('connectedServiceName');
var genericEndpoint = tl.getInput('connectedServiceName');
var auth = tl.getEndpointAuthorization(cred, false);
var username = auth.parameters['username'];
var password = auth.parameters['password'];
var baseURL = tl.getEndpointUrl(genericEndpoint,false);

// Get TeamCity BuildType and shelveset name from task
var buildType = tl.getPathInput('buildType', true, false);
var shelvesetName = tl.getPathInput('shelvesetName');

tr.pathArg(path.join( __dirname, pyScript));
var args = [baseURL,buildType,shelvesetName,username,password];
tr.arg(args);

var failOnStdErr = tl.getBoolInput('failOnStandardError', false);

tr.exec(<any>{failOnStdErr: failOnStdErr})
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('BashReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('BashFailed', err.message));
})