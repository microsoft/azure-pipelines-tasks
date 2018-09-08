import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'msbuild.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('solution', '**/*.sln');
tr.setInput('platform', '$(Platform)');
tr.setInput('configuration', '$(Configuration)');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xbuild": "/home/bin/xbuild"
    },
    "checkPath": {
        "/home/bin/xbuild": true
    },
    "findMatch": {
        "**/*.sln": [
            "/user/build/fun.sln"
        ]
    },
    "exec": {
        "/home/bin/xbuild /user/build/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration)": {
            "code": 0,
            "stdout": "xbuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();

