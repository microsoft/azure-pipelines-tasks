import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import util = require('./NugetMockHelper');

let taskPath = path.join(__dirname, '..', 'nugetinstaller.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('solution', 'packages.config');
tmr.setInput('selectOrConfig', 'select');
tmr.setInput('feed', 'https://codesharing-su0.pkgs.visualstudio.com/_packaging/NuGetFeed/nuget/v3/index.json');



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
    }
};
nmh.setAnswers(a);

process.env["NuGet_ForceEnableCredentialConfig"] = "false";
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\packages.config"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.RegisterLocationServiceMocks();

tmr.run();
