import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'pack');
tmr.setInput('searchPatternPack', 'single.csproj');
tmr.setInput('outputDir', 'C:\\out\\dir');
tmr.setInput('versioningScheme', 'byBuildNumber');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\single.csproj": true,
        "c:\\path\\dotnet.exe": true
    },
    "which": {
        "dotnet": "c:\\path\\dotnet.exe"
    },
    "exec": {
        "c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\single.csproj --output C:\\out\\dir /p:PackageVersion=1.2.3": {
            "code": 0,
            "stdout": "dotnet output",
            "stderr": ""
        }
    },
    "exist": {
    	"C:\\out\\dir": true
    },
    "stats": {
        "c:\\agent\\home\\directory\\single.csproj": {
            "isFile": true
        }
    },
    "findMatch": {
        "fromMockedUtility-single.csproj": ["c:\\agent\\home\\directory\\single.csproj"]
    }
};
nmh.setAnswers(a);

process.env['BUILD_BUILDNUMBER'] = '1.2.3'
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\single.csproj"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerNuGetPackUtilsMock();

tmr.run();
