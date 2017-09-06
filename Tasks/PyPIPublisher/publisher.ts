var os = require('os');
var path = require('path');
var util = require("util");
var tl = require('vsts-task-lib');

var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var homedir = os.homedir();
var pypircFilePath = path.join(homedir, ".pypirc");
var setupFilePath = path.join(workingDirectory, "setup.py");
var distDirectoryPath = path.join(workingDirectory, "dist");
var uploadArtifactsPath = distDirectoryPath+"/*";

//Generic service endpoint
var pythonServer = tl.getEndpointUrl(serviceEndpointId, false);
var username = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false);
var password = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false);

//Create .pypirc file
var text = util.format("[distutils] \nindex-servers =\n    pypi \n[pypi] \nrepository=%s \nusername=%s \npassword=%s", pythonServer, username, password);
tl.writeFile(pypircFilePath, text, 'utf8');
publishPythonPackage();

async function publishPythonPackage(){
    //PyPI upload
    try{
        await executePythonTool("-m pip install wheel twine --user");
        await executePythonTool(util.format("%s sdist --dist-dir %s bdist_wheel", setupFilePath, distDirectoryPath));    
        await executePythonTool(util.format("-m twine upload %s", uploadArtifactsPath));    
    }
    catch(err){
        tl.setResult(tl.TaskResult.Failed, err);
    }
    finally{
        tl.setResult(tl.TaskResult.Succeeded, "Upload Successful");
        //Delete .pypirc file
        tl.rmRF(pypircFilePath);
    };
}

async function executePythonTool(lineToAdd){
    await tl.tool(tl.which('python', true)).line(lineToAdd).exec().fail(function (err) {
        throw new Error(err);
    });
}