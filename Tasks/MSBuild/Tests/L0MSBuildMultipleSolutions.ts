import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'msbuild.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('solution', '**/*.sln');
tr.setInput('platform', '$(Platform)');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('clean', 'true');
tr.setInput('msbuildArguments', '/p:TestProp=TestValue /p:TestProp1=TestValue');

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
            "/user/build/fun.sln",
            "/user/build/test/fun.sln"
        ]
    },
    "exec": {
        "/home/bin/xbuild /user/build/fun.sln /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        },
        "/home/bin/xbuild /user/build/test/fun.sln /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        },
        "/home/bin/xbuild /user/build/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        },
        "/home/bin/xbuild /user/build/test/fun.sln /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();

