import path = require('path');
import tl = require('vsts-task-lib/task');

tl.setResourcePath(path.join( __dirname, 'task.json'));
var pyScript = path.join( __dirname, 'TeamCityBuild.py')

var tr = tl.createToolRunner(tl.which('bash', true));

var cwd = tl.getPathInput('workingFolder', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);
// Get TeamCity URL and credentials from endpoint 
var cred = tl.getPathInput('connectedServiceName');
var auth = tl.getEndpointAuthorization(cred, false);
var username = auth.parameters['username'];
var password = auth.parameters['password'];
var baseURL = auth.parameters['url']

// Get TeamCity BuildType and shelveset name from task
var buildType = tl.getPathInput('buildType', true, false);
var shelvesetName = tl.getPathInput('shelvesetName');


tl.debug(("Script       : %s", pyScript));
tl.debug(("Server URL   : %s", baseURL));
tl.debug(("User Name    : %s", username));
tl.debug(("build Type   : %s", buildType));
tl.debug(("User Name    : %s", username));

//tr.arg(tl.getInput(("python %s %s %s %s %s %s",pyScript,baseURL,buildType,shelvesetName,username,password), false));
var scriptPath = tl.getPathInput(("python %s %s %s %s %s %s",pyScript,baseURL,buildType,shelvesetName,username,password), true, true);

tr.pathArg(scriptPath);

tr.arg(tl.getInput('args', false));

var failOnStdErr = tl.getBoolInput('failOnStandardError', false);

tr.exec(<any>{failOnStdErr: failOnStdErr})
.then(function(code) {
	tl.setResult(tl.TaskResult.Succeeded, tl.loc('BashReturnCode', code));
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.setResult(tl.TaskResult.Failed, tl.loc('BashFailed', err.message));
})


