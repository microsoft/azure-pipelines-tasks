import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

let taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

process.env['ENDPOINT_URL_ENDPOINT1'] = "https://endpoint1.visualstudio.com/path";
process.env['ENDPOINT_AUTH_ENDPOINT1'] = "{\"parameters\":{\"apitoken\":\"mytoken123\"},\"scheme\":\"token\"}";
process.env["ENDPOINT_AUTH_SCHEME_ENDPOINT1"] = "token";
process.env['ENDPOINT_AUTH_PARAMETER_ENDPOINT1_APITOKEN'] = "mytoken123";
process.env['ENDPOINT_URL_ENDPOINT2'] = "https://endpoint2.visualstudio.com/path";
process.env['ENDPOINT_AUTH_ENDPOINT2'] = "{\"parameters\":{\"apitoken\":\"mytoken123\"},\"scheme\":\"token\"}";
process.env["ENDPOINT_AUTH_SCHEME_ENDPOINT2"] = "token";
process.env['ENDPOINT_AUTH_PARAMETER_ENDPOINT1_APITOKEN'] = "mytoken123";

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'restore');
tmr.setInput('solution', 'single.sln');
tmr.setInput('selectOrConfig', 'config');
tmr.setInput('nugetConfigPath', 'c:\\agent\\home\\directory\\nuget.config');
tmr.setInput('externalEndpoints', "ENDPOINT1,ENDPOINT2");

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

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\single.sln"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerNugetConfigMock();
nmh.registerToolRunnerMock();

tmr.run();
