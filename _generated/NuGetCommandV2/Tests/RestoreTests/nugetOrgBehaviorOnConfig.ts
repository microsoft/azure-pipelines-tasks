import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

let taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);


nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'restore');
tmr.setInput('solution', 'single.sln');
tmr.setInput('selectOrConfig', 'config');
tmr.setInput('includeNuGetOrg', 'True');
tmr.setInput('nugetConfigPath', 'c:\\agent\\home\\directory\\nuget.config');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\nuget.config": true,
        "c:\\agent\\home\\directory\\single.sln": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\single.sln -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {},
    "stats": {
        "c:\\agent\\home\\directory\\single.sln": {
            "isFile": true
        }
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\tempNuGet_.config": {
            "success": true
        }
    }, 
    "findMatch": {
        "single.sln" : ["c:\\agent\\home\\directory\\single.sln"]
    }
};
nmh.setAnswers(a);

process.env["NuGet_ForceEnableCredentialConfig"] = "false";
process.env["INCLUDE_NUGETORG_BEHAVIOR"] = "Fail";
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\single.sln"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerNugetConfigMock();
nmh.registerToolRunnerMock();

tmr.run();
