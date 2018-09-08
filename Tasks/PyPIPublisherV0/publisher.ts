var tl = require('vsts-task-lib/task');
var os = require('os');
var path = require('path');
var util = require("util");

var workingDirectory = tl.getInput('wd', true);
var serviceEndpointId = tl.getInput('serviceEndpoint', true);
var wheel: boolean = tl.getBoolInput('wheel');
var homedir = os.homedir();
var pypircFilePath = path.join(homedir, ".pypirc");
var pythonToolPath = tl.which('python', true);
var error = '';

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
        if(wheel){
            await executePythonTool("-m pip install wheel --user");
            await executePythonTool("setup.py bdist_wheel --universal");
        }
        await executePythonTool("-m twine upload dist/*");
    }
    catch(err){
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally{
        //Delete .pypirc file
        tl.rmRF(pypircFilePath);
        tl.setResult(tl.TaskResult.Succeeded);
    };
}

async function executePythonTool(commandToExecute){
    var pythonTool = tl.tool(pythonToolPath);
    pythonTool.on('stderr', function (data) {
        error += (data || '').toString();
    });
    await pythonTool.line(commandToExecute).exec();
}

run();
