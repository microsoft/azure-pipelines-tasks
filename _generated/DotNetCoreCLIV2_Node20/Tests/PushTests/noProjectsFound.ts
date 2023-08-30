import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'push');
tmr.setInput('searchPatternPush', 'foo.nupkg');
tmr.setInput('nuGetFeedType', 'internal');
tmr.setInput('feedPublish', 'FeedFooId');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\foo.nupkg": true,
        "c:\\path\\dotnet.exe": true
    },
    "which": {
        "dotnet": "c:\\path\\dotnet.exe"
    },
    "exec": {
        "c:\\path\\dotnet.exe nuget push --source https://vsts/packagesource --api-key VSTS": {
            "code": 0,
            "stdout": "dotnet output",
            "stderr": ""
        }
    },
    "exist": {},
    "stats": {
        "c:\\agent\\home\\directory\\foo.nupkg": {
            "isFile": true
        }
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\NuGet_1": {
            "success": true
        },
        "c:\\agent\\home\\directory/NuGet_1": {
            "success": true
        }
    },
    "findMatch": {
        "fromMockedUtility-foo.nupkg": []
    }
};
nmh.setAnswers(a);

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nupkg"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.RegisterLocationServiceMocks();

tmr.run();
