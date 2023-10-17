import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./NugetMockHelper');

import nMockHelper = require('azure-pipelines-tasks-packaging-common/Tests/NuGetMockHelper');

let taskPath = path.join(__dirname, '..', 'nugetinstaller.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr, true);

nmh.setNugetVersionInputDefault();
tmr.setInput('solution', 'single.sln');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {
        "osType" : "Linux"
    },
    "checkPath": {
        "~/myagent/_work/1/s/single.sln": true,
        "/usr/bin/mono": true
    },
    "which": {
        "mono":"/usr/bin/mono"
    },
    "exec": {
        "/usr/bin/mono ~/myagent/_work/_tasks/NuGet/nuget.exe restore -NonInteractive ~/myagent/_work/1/s/single.sln": {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {
        "~/myagent/_work/_tasks/NuGet/nuget.exe": true,
        "~/myagent/_work/_tasks/NuGet/CredentialProvider.TeamBuild.exe": true
    },
    "stats": {
        "~/myagent/_work/1/s/single.sln": {
            "isFile": true
        }
    }
};
tmr.setAnswers(a);

process.env['AGENT_HOMEDIRECTORY'] = "~/myagent/_work/1";
process.env['BUILD_SOURCESDIRECTORY'] = "~/myagent/_work/1/s",
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"json\" : \"value\"}";
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "~/myagent/_work/1/s";
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";

nMockHelper.registerNugetUtilityMockUnix(tmr, ["~/myagent/_work/1/s/single.sln"]);

nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();

tmr.run();
