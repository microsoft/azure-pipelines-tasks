import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import VersionInfoVersion from 'nuget-task-common/pe-parser/VersionInfoVersion'
import {VersionInfo, VersionStrings} from 'nuget-task-common/pe-parser/VersionResource'

let taskPath = path.join(__dirname, '..', 'nugetinstaller.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('solution', 'single.sln');
tmr.setInput('nuGetVersion', '3.3.0');

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


tmr.registerMock('./pe-parser', {
    getFileVersionInfoAsync: function(nuGetExePath) {
        let result: VersionInfo = { strings: {} };
        result.fileVersion = new VersionInfoVersion(3, 3, 0, 212);
        result.strings['ProductVersion'] = "3.3.0";
        return result;
    }
} )

tmr.registerMock('nuget-task-common/Utility', {
    resolveFilterSpec: function(filterSpec, basePath?, allowEmptyMatch?) {
        return ["~/myagent/_work/1/s/single.sln"];
    },
    getBundledNuGetLocation: function(version) {
        return '~/myagent/_work/_tasks/NuGet/nuget.exe';
    }
} )

// Required for NuGetToolRunner
var mtt = require('vsts-task-lib/mock-toolrunner');
tmr.registerMock('vsts-task-lib/toolrunner', mtt);

tmr.run();
