import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

let taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'restore');
tmr.setInput('solution', 'packages.config');
tmr.setInput('selectOrConfig', 'config');
tmr.setInput('nugetConfigPath', 'c:\\foobar\\config\\directory\\NuGet_.config');


let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\packages.config": true,
        "c:\\foobar\\config\\directory\\NuGet_.config": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe restore c:\\agent\\home\\directory\\packages.config -NonInteractive -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {"c:\\foobar\\config\\directory\\NuGet_.config": true},
    "stats": {
        "c:\\agent\\home\\directory\\packages.config": {
            "isFile": true
        }
    }, 
    "findMatch": {
        "packages.config" : ["c:\\agent\\home\\directory\\packages.config"]
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\tempNuGet_.config": { success: true }
    }
};
nmh.setAnswers(a);

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\packages.config"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();
