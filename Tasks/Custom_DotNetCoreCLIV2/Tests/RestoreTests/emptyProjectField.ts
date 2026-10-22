import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'restore');
tmr.setInput('projects', '');
tmr.setInput('selectOrConfig', 'select');
tmr.setInput('includeNuGetOrg', 'True');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\single.csproj": true,
        "c:\\path\\dotnet.exe": true
    },
    "which": {
        "dotnet": "c:\\path\\dotnet.exe"
    },
    "exec": {
        "c:\\path\\dotnet.exe restore --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config": {
            "code": 0,
            "stdout": "dotnet output",
            "stderr": ""
        }
    },
    "exist": {
        "D:\\src\\github\\vsts-tasks\\Tests\\Nuget": true
    },
    "stats": {
        "c:\\agent\\home\\directory\\single.csproj": {
            "isFile": true
        }
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config": {
            "success": true
        }
    },
    "findMatch": {
        "": []
    }
};
nmh.setAnswers(a);

nmh.registerNugetUtilityMock([""]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();
