import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./NugetMockHelper');

let taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('solution', 'packages.config');
tmr.setInput('selectOrConfig', 'select');
tmr.setInput('includeNuGetOrg', 'True');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\packages.config": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {},
    "stats": {
        "c:\\agent\\home\\directory\\packages.config": {
            "isFile": true
        }
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\tempNuGet_.config": { success: true }
    }, 
    "findMatch": {
        "packages.config" : ["c:\\agent\\home\\directory\\packages.config"]
    }
};

nmh.setAnswers(a);

process.env["NuGet_ForceEnableCredentialConfig"] = "false";
process.env["INCLUDE_NUGETORG_BEHAVIOR"] = "Fail";
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\packages.config"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();
