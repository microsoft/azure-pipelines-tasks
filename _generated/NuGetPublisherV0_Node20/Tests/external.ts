import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./NugetMockHelper');

let taskPath = path.join(__dirname, '..', 'nugetpublisher.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('searchPattern', 'package.nupkg');
tmr.setInput('nuGetFeedType', 'external');
tmr.setInput('connectedServiceName', 'testFeedExternalUri');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\package.nupkg": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe push -NonInteractive c:\\agent\\home\\directory\\package.nupkg -Source https://example.feed.com -ApiKey secret": {
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
    }
};
nmh.setAnswers(a);

process.env['ENDPOINT_AUTH_testFeedExternalUri'] = "{\"parameters\":{\"password\":\"secret\"},\"scheme\":\"Basic\"}";
process.env['ENDPOINT_URL_testFeedExternalUri'] = "https://example.feed.com";

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\package.nupkg"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerNugetConfigMock();
nmh.registerToolRunnerMock();

tmr.run();
