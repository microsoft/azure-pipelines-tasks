import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'restore');
tmr.setInput('projects', 'single.csproj');
tmr.setInput('selectOrConfig', 'select');
if(process.env["__nocache__"]) {
    tmr.setInput('noCache', process.env["__nocache__"]);
 }
if(process.env["__verbosity__"]) {
    tmr.setInput('verbosityRestore', process.env["__verbosity__"])
}

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
        "c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config": {
            "code": 0,
            "stdout": "dotnet output",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --no-cache": {
            "code": 0,
            "stdout": "dotnet output, no-cache",
            "stderr": ""
        },
        "c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --verbosity Detailed": {
            "code": 0,
            "stdout": "dotnet output, verbosity Detailed",
            "stderr": ""
        }
    },
    "exist": {
        "D:\\src\\github\\vsts-tasks\\Tests\\Nuget" : true
    },
    "stats": {
        "c:\\agent\\home\\directory\\single.csproj": {
            "isFile": true
        }
    },
    "findMatch": {
        "single.csproj" : ["c:\\agent\\home\\directory\\single.csproj"]
    }
};
nmh.setAnswers(a);

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\single.csproj"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();
