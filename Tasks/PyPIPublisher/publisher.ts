var tl = require('vsts-task-lib/task');
var os = require('os');
var path = require('path');
var util = require("util");

var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var homedir = os.homedir();
var pypircFilePath = path.join(homedir, ".pypirc");
var pythonToolPath = tl.which('python', true);

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
        tl.cd(workingDirectory);
        await executePythonTool("-m pip install twine --user");
        await executePythonTool("setup.py sdist");
        await executePythonTool("-m twine upload dist/*");
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

async function executePythonTool(commandToExecute){
    await tl.tool(pythonToolPath).line(commandToExecute).exec();
}

run();
