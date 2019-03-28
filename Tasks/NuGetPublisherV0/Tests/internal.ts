import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./NugetMockHelper');

let taskPath = path.join(__dirname, '..', 'nugetpublisher.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('searchPattern', 'package.nupkg');
tmr.setInput('nuGetFeedType', 'internal');
tmr.setInput('feedName', 'testFeedUri');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\package.nupkg": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe push -NonInteractive c:\\agent\\home\\directory\\package.nupkg -Source testFeedUri -ApiKey VSTS -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {},
    "stats": {
        "c:\\agent\\home\\directory\\package.nupkg": {
            "isFile": true
        }
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\tempNuGet_.config": {
            "success": true
        }
    }
};
nmh.setAnswers(a);

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\package.nupkg"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerNugetConfigMock();
nmh.registerToolRunnerMock();

tmr.run();
