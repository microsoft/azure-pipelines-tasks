import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xamarinandroid.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/user/home'; //replace with mock of setVariable when task-lib has the support

tr.setInput('project', '**/test*.csproj');
tr.setInput('target', '');
tr.setInput('clean', 'false');
tr.setInput('createAppPackage', 'true');
tr.setInput('outputDir', '');
tr.setInput('configuration', '');
tr.setInput('msbuildLocationMethod', 'version');
tr.setInput("msbuildVersion", "15.0");
tr.setInput('msbuildLocation', '');
tr.setInput('msbuildArguments', '');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('jdkVersion', 'default');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "getVariable": {
        "HOME": "/user/home"
    },
    "which": {
        "msbuild": "/home/bin/msbuild"
    },
    "exec": {
        "/home/bin/msbuild /version /nologo": {
            "code": 0,
            "stdout": "15.1.0.0"
        },
        "/home/bin/msbuild /user/build/fun/test.csproj /t:PackageForAndroid": {
            "code": 0,
            "stdout": "Xamarin android project"
        }
    },
    "findMatch": {
        "**/test*.csproj": [
            "/user/build/fun/test.csproj"
        ]
    }
};
tr.setAnswers(a);

tr.run();

