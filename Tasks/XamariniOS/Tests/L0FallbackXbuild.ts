
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xamarinios.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME']='/user/home'; //replace with mock of setVariable when task-lib has the support

tr.setInput('solution', 'src/project.sln'); //path
tr.setInput('configuration', 'Release');
tr.setInput('args', '');
tr.setInput('packageApp', ''); //boolean
tr.setInput('forSimulator', ''); //boolean
tr.setInput('runNugetRestore', 'false'); //boolean
tr.setInput('iosSigningIdentity', '');
tr.setInput('provProfileUuid', '');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "HOME": "/user/home"
    },
    "which": {
        "xbuild": "/home/bin/xbuild"
    },
    "exec": {
        "/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean": {
            "code": 0,
            "stdout": "xbuild"
        },
        "/home/bin/xbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone": {
            "code": 0,
            "stdout": "xbuild"
        }
    },
    "checkPath" : {
        "/user/build": true,
        "/home/bin/xbuild": true,
        "src/project.sln": true
    },
    "findMatch" : {
        "src/project.sln": ["src/project.sln"]
    }
};
tr.setAnswers(a);

tr.run();

