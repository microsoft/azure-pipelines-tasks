import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'xamarinios.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME']='/user/home'; //replace with mock of setVariable when task-lib has the support

// Required inputs
tr.setInput('solution', 'src/project.sln'); //path
tr.setInput('configuration', '');
// Optional inputs
tr.setInput('args', '');
tr.setInput('packageApp', ''); //boolean
tr.setInput('forSimulator', ''); //boolean
tr.setInput('buildToolLocation', '');
tr.setInput('iosSigningIdentity', '');
tr.setInput('provProfileUuid', '');


// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "HOME": "/user/home"
    },
    "which": {
        "msbuild": "/home/bin/msbuild",
        "nuget": "/home/bin/nuget"
    },
    "exec": {
        "/home/bin/msbuild /version /nologo": {
            "code": 0,
            "stdout": "15.1.0.0"
        }
    },
    "checkPath" : {
        "/user/build": true,
        "/home/bin/msbuild": true,
        "/home/bin/nuget": true,
        "src/project.sln": true
    },
    "findMatch" : {
        "src/project.sln": ["src/project.sln"]
    }
};
tr.setAnswers(a);

os.platform = () => {
    return 'darwin';
}
tr.registerMock('os', os);

tr.run();
