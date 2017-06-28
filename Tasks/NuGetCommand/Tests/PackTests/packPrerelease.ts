import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

let taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'pack');
tmr.setInput('searchPatternPack', 'foo.nuspec');
tmr.setInput('outputDir', 'C:\\out\\dir');
tmr.setInput('command', 'pack');
tmr.setInput('versioningScheme', 'byPrereleaseNumber');
tmr.setInput('requestedMajorVersion', 'x');
tmr.setInput('requestedMinorVersion', 'y');
tmr.setInput('requestedPatchVersion', 'z');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\foo.nuspec": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -version x.y.z-CI-YYYYMMDD-HHMMSS": {
            "code": 0,
            "stdout": "NuGet output here",
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
    }
};
nmh.setAnswers(a);

nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nuspec"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerNuGetPackUtilsMock();

tmr.run();
