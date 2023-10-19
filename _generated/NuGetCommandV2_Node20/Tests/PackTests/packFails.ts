import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
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
tmr.setInput('versioningScheme', 'byBuildNumber');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\foo.nuspec": true
    },
    "which": {},
    "exec": {
        "c:\\from\\tool\\installer\\nuget.exe pack c:\\agent\\home\\directory\\foo.nuspec -NonInteractive -OutputDirectory C:\\out\\dir -version 1.2.3": {
            "code": 1,
            "stdout": "",
            "stderr": "stderr output is here"
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
        "foo.nuspec" : ["c:\\agent\\home\\directory\\foo.nuspec"]
    }
};
nmh.setAnswers(a);

process.env['BUILD_BUILDNUMBER'] = '1.2.3'
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\foo.nuspec"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerNuGetPackUtilsMock(new Date());

tmr.run();
