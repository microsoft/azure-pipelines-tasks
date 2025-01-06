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
        "/usr/bin/mono c:\\from\\tool\\installer\\nuget.exe restore ~/myagent/_work/1/s/single.sln -NonInteractive": {
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
    }, 
    "findMatch": {
        "single.sln" : ["~/myagent/_work/1/s/single.sln"]
    }
};
tmr.setAnswers(a);

process.env['AGENT_HOMEDIRECTORY'] = "~/myagent/_work/1";
process.env['BUILD_SOURCESDIRECTORY'] = "~/myagent/_work/1/s",
process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"json\" : \"value\"}";
process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "~/myagent/_work/1/s";
process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";

nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerNugetUtilityMockUnix(["~/myagent/_work/1/s/single.sln"]);

tmr.run();
