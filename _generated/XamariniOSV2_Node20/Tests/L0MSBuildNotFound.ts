import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, '..', 'xamarinios.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME']='/user/home'; //replace with mock of setVariable when task-lib has the support

// Required inputs
tr.setInput('solution', 'src/project.sln'); //path
tr.setInput('configuration', 'Release');
// Optional inputs
tr.setInput('args', '');
tr.setInput('packageApp', ''); //boolean
tr.setInput('forSimulator', ''); //boolean
tr.setInput('buildToolLocation', '/user/bin/');
tr.setInput('iosSigningIdentity', '');
tr.setInput('provProfileUuid', '');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "HOME": "/user/home"
    },
    "checkPath" : {
        "/user/build": true,
        "/user/bin": false,
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
