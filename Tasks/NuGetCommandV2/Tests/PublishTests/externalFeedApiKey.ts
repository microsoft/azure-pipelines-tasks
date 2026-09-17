import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as auth from 'azure-pipelines-tasks-packaging-common/nuget/Authentication';
import util = require('../NugetMockHelper');

const taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'push');
tmr.setInput('searchPatternPush', 'foo.nupkg');
tmr.setInput('nuGetFeedType', 'external');
tmr.setInput('connectedServiceName', 'externalNuGetFeed');

const packageSource: auth.IPackageSource = {
    feedName: 'externalNuGetFeed',
    feedUri: 'foobar',
    isInternal: false,
};
tmr.registerMock('azure-pipelines-tasks-packaging-common/nuget/CommandHelper', {
    GetExternalAuthInfoArray: () => [new auth.ApiKeyExternalAuthInfo(packageSource, 'secret-api-key')],
});

const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\foo.nupkg": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe push c:\\agent\\home\\directory\\foo.nupkg -NonInteractive -Source foobar -ConfigFile c:\\agent\\home\\directory\\tempNuGet_.config": {
            "code": 0,
            "stdout": "NuGet output here",
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
        "foo.nupkg": ["c:\\agent\\home\\directory\\foo.nupkg"]
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\tempNuGet_.config": {
            "success": true,
            "message": "success"
        }
    }
};
nmh.setAnswers(answers);

process.env["NUGET_FORCENUGETFORPUSH"] = "true";
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nupkg"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerNugetVersionMock('7.6.0', [7, 6, 0, 0]);
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();