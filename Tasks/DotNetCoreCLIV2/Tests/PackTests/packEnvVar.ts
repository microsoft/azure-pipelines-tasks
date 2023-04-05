import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'pack');
tmr.setInput('searchPatternPack', 'foo.nuspec');
tmr.setInput('outputDir', 'C:\\out\\dir');
tmr.setInput('versioningScheme', 'byEnvVar');
tmr.setInput('versionEnvVar', 'FOOBARVERSIONENVVAR');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\foo.nuspec": true,
        "c:\\path\\dotnet.exe": true
    },
    "which": {
        "dotnet": "c:\\path\\dotnet.exe"
    },
    "exec": {
        "c:\\path\\dotnet.exe pack -p:NuspecFile=c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=XX.YY.ZZ": {
            "code": 0,
            "stdout": "dotnet output",
            "stderr": ""
        }
    },
    "exist": {
    	"C:\\out\\dir": true
    },
    "stats": {
        "c:\\agent\\home\\directory\\foo.nuspec": {
            "isFile": true
        }
    },
    "findMatch": {
        "fromMockedUtility-foo.nuspec" : ["c:\\agent\\home\\directory\\foo.nuspec"]
    }
};
nmh.setAnswers(a);

process.env['FOOBARVERSIONENVVAR'] = 'XX.YY.ZZ'
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nuspec"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerNuGetPackUtilsMock();

tmr.run();
