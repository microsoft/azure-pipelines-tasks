import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./NugetMockHelper');
import nMockHelper = require('azure-pipelines-tasks-packaging-common/Tests/NuGetMockHelper');

let taskPath = path.join(__dirname, '..', 'nugetinstaller.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('solution', '**//*.sln');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\single.sln": true,
        "c:\\agent\\home\\directory\\double\\double.sln": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\single.sln": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        },
       "c:\\from\\tool\\installer\\nuget.exe restore -NonInteractive c:\\agent\\home\\directory\\double\\double.sln": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {},
    "stats": {
        "c:\\agent\\home\\directory\\single.sln": {
            "isFile": true
        },
        "c:\\agent\\home\\directory\\double\\double.sln": {
            "isFile": true
        }
	}
};
nmh.setAnswers(a);

nMockHelper.registerNugetUtilityMock(tmr, ["c:\\agent\\home\\directory\\single.sln", "c:\\agent\\home\\directory\\double\\double.sln"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();

tmr.run();
