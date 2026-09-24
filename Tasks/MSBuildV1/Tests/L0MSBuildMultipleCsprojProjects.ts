import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'msbuild.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('solution', '**/*.csproj');
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
        "**/*.csproj": [
            "/user/build/fun.csproj",
            "/user/build/test/fun.csproj"
        ]
    },
    "exec": {
        "/home/bin/xbuild /user/build/fun.csproj /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        },
        "/home/bin/xbuild /user/build/test/fun.csproj /t:Clean /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        },
        "/home/bin/xbuild /user/build/fun.csproj /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        },
        "/home/bin/xbuild /user/build/test/fun.csproj /p:Platform=$(Platform) /p:Configuration=$(Configuration) /p:TestProp=TestValue /p:TestProp1=TestValue": {
            "code": 0,
            "stdout": "xbuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();
