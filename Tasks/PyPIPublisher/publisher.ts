import * as tl from 'vsts-task-lib/task';
var os = require('os');
var path = require('path');
var util = require("util");

var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var homedir = os.homedir();
var pypircFilePath = path.join(homedir, ".pypirc");
var setupFilePath = path.join(workingDirectory, "setup.py");
var distDirectoryPath = path.join(workingDirectory, "dist");
var uploadArtifactsPath = distDirectoryPath + "/*";

//Generic service endpoint
var pythonServer = tl.getEndpointUrl(serviceEndpointId, false);
var username = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false);
var password = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false);

//Create .pypirc file
var text = util.format("[distutils] \nindex-servers =\n    pypi \n[pypi] \nrepository=%s \nusername=%s \npassword=%s", pythonServer, username, password);
tl.writeFile(pypircFilePath, text, 'utf8');

async function run(){
    //PyPI upload
    try{
        await executePythonTool("-m pip install wheel twine --user");
        await executePythonTool(util.format("%s sdist --dist-dir %s bdist_wheel", setupFilePath, distDirectoryPath));
        await executePythonTool(util.format("-m twine upload %s", uploadArtifactsPath));
    }
    catch(err){
        tl.setResult(tl.TaskResult.Failed, "Upload Failed");
    }
    finally{
        //Delete .pypirc file
        tl.rmRF(pypircFilePath);
        tl.setResult(tl.TaskResult.Succeeded, "Upload Successful");
    };
}

async function executePythonTool(lineToAdd){
    await tl.tool(tl.which('python', true)).line(lineToAdd).exec();
}

run();
