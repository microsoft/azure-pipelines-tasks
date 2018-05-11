
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xamarinios.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME']='/user/home'; //replace with mock of setVariable when task-lib has the support

tr.setInput('solution', 'src/project.sln'); //path
tr.setInput('configuration', 'Release');
tr.setInput('args', '');
tr.setInput('clean', 'true');
tr.setInput('packageApp', ''); //boolean
tr.setInput('forSimulator', ''); //boolean
tr.setInput('runNugetRestore', 'true'); //boolean
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
        },
        "/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone /t:Clean": {
            "code": 0,
            "stdout": "msbuild"
        },
        "/home/bin/nuget restore src/project.sln": {
            "code": 0,
            "stdout": "nuget restore"
        },
        "/home/bin/msbuild src/project.sln /p:Configuration=Release /p:Platform=iPhone": {
            "code": 0,
            "stdout": "msbuild"
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

tr.run();

