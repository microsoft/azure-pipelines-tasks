var tl = require('vsts-task-lib');
var os = require('os');
var path = require('path');
var util = require("util");
var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var homedir = os.homedir();
var pypircFilePath = path.join(homedir, ".pypirc");
var setupFilePath = path.join(workingDirectory, "setup.py");
var distDirectoryPath = path.join(path.normalize(path.join(workingDirectory, "..")), "dist")+"/*";

//Generic service endpoint
var pythonServer = tl.getEndpointUrl(serviceEndpointId, false);
var username = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'username', false);
var password = tl.getEndpointAuthorizationParameter(serviceEndpointId, 'password', false);

//Create .pypirc file
var text = util.format("[distutils] \nindex-servers =\n    pypi \n[pypi] \nrepository=%s \nusername=%s \npassword=%s", pythonServer, username, password);
tl.writeFile(pypircFilePath, text, 'utf8');

//PyPI upload
try{
    executePythonTool("-m pip install wheel twine --user");
    executePythonTool(util.format("%s sdist bdist_wheel", setupFilePath));    
    executePythonTool(util.format("-m twine upload %s", distDirectoryPath));    
}
catch(err){
    tl.setResult(tl.TaskResult.Failed, err);
}
finally{
    tl.setResult(tl.TaskResult.Succeeded, "Upload Successful");
    //Delete .pypirc file
    tl.rmRF(pypircFilePath);
};

function executePythonTool(lineToAdd){
    var result = tl.tool(tl.which('python', true)).line(lineToAdd).execSync();
    if(result.code != 0) {
        throw new Error(result.error ? result.error.message : result.stderr);
    }
}