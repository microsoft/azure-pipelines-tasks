var tl = require('vsts-task-lib');
var os = require('os');
var path = require('path');
var util = require("util");
var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var homedir = os.homedir();
var pypircFilePath = path.join(homedir,".pypirc");
var setupFilePath = path.join(workingDirectory, "setup.py");

//Generic service endpoint
var pythonServer = tl.getEndpointUrl(serviceEndpointId, false);
var username = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false);
var password = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false);

//Create .pypirc file
var text = util.format("[distutils] \nindex-servers =\n    pypi \n[pypi] \nrepository=%s \nusername=%s \npassword=%s", pythonServer, username, password);
tl.writeFile(pypircFilePath, text, 'utf8');

//PyPI upload command
var cmdToRun = util.format(" %s sdist upload -r pypi", setupFilePath);
try {
    var pythonTool = tl.tool(tl.which('python', true));
    pythonTool.line(cmdToRun);
    pythonTool.exec().then(function () {
        tl.setResult(tl.TaskResult.Succeeded, "Upload Successful");
    }).fail(function (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }).finally(function (err) {
        //Delete .pypirc file
        tl.rmRF(pypircFilePath);
    });
}
catch (err) {
    tl.setResult(tl.TaskResult.Failed, err);
}