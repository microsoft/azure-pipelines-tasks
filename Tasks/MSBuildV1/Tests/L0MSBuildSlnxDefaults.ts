import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'msbuild.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('solution', '**/*.slnx');
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
        "**/*.slnx": [
            "/user/build/fun.slnx"
        ]
    },
    "exec": {
        "/home/bin/xbuild /user/build/fun.slnx /p:Platform=$(Platform) /p:Configuration=$(Configuration)": {
            "code": 0,
            "stdout": "xbuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();
