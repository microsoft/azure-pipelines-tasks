import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

let taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'push');
tmr.setInput('searchPatternPush', 'foo.nupkg');
tmr.setInput('nuGetFeedType', 'internal');
tmr.setInput('feedPublish', 'FeedFooId');
tmr.setInput('allowPackageConflicts', 'false');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\foo.nupkg": true
    },
    "which": {},
    "exec": {
        "c:\\agent\\home\\directory\\externals\\nuget\\VstsNuGetPush.exe c:\\agent\\home\\directory\\foo.nupkg -Source https://vsts/packagesource -AccessToken token -NonInteractive": {
            "code": 2,
            "stdout": "VstsNuGetPush output here",
            "stderr": ""
        }
    },
    "exist": {},
    "stats": {
        "c:\\agent\\home\\directory\\foo.nupkg": {
            "isFile": true
        }
    }, 
    "findMatch": {
        "foo.nupkg" : ["c:\\agent\\home\\directory\\foo.nupkg"]
    }
};
nmh.setAnswers(a);

process.env["NUGET_FORCEVSTSNUGETPUSHFORPUSH"] = "true";
process.env["SYSTEM_SERVERTYPE"] = "Hosted";
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nupkg"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerVstsNuGetPushRunnerMock();

tmr.run();
