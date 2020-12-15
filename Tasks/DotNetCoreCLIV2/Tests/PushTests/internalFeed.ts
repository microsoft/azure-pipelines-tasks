import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);
console.log("trying to set nuget version")
nmh.setNugetVersionInputDefault();
console.log("nuget version set")
console.log("setting input")
tmr.setInput('command', 'push');
tmr.setInput('searchPatternPush', 'foo.nupkg');
tmr.setInput('nuGetFeedType', 'internal');
tmr.setInput('feedPublish', 'ProjectId/FeedFooId');

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
        "c:\\path\\dotnet.exe nuget push c:\\agent\\home\\directory\\foo.nupkg --source https://vsts/packagesource --api-key VSTS": {
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
        "fromMockedUtility-foo.nupkg" : ["c:\\agent\\home\\directory\\foo.nupkg"]
    }
};
console.log("setting answers")
nmh.setAnswers(a);
console.log("1........")
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nupkg"]);
console.log("2........")
nmh.registerDefaultNugetVersionMock();
console.log("3........")
nmh.registerToolRunnerMock();
console.log("4........")
nmh.registerNugetConfigMock();
console.log("5........")
nmh.RegisterLocationServiceMocks();
console.log("6........")

tmr.run();
