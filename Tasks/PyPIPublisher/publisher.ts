var tl = require('vsts-task-lib');
var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var os = require('os');
var shell = require('shelljs');
var homedir = os.homedir();

//Generic service endpoint
var auth = tl.getEndpointAuthorization(serviceEndpointId, false);
var pythonServer = tl.getEndpointUrl(serviceEndpointId, false);
var username = auth['parameters']['username'];
var password = auth['parameters']['password'];

//Create .pypirc file
var text = "[distutils] \nindex-servers =\n    pypi \n[pypi] \nrepository=" + pythonServer + " \nusername=" + username + " \npassword=" + password;
tl.writeFile(homedir + '\\.pypirc', text, 'utf8');

//PyPI upload command
var cmdToRun = "python " + workingDirectory + "\\setup.py sdist upload -r pypi";

shell.exec(cmdToRun, (err, stdout, stderr) => {
    try {
        if (err) {
            tl.setResult(tl.TaskResult.Failed, stderr);
        }
        else {
            tl.setResult(tl.TaskResult.Succeeded, "Upload Successful");
        }
    }
    finally {
        //Delete .pypirc file
        tl.rmRF(homedir + '\\.pypirc');
    }
});