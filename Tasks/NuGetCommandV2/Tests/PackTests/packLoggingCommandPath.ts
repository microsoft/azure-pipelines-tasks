import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../NugetMockHelper');

const taskPath = path.join(__dirname, '../..', 'nugetcommandmain.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.NugetMockHelper = new util.NugetMockHelper(tmr);
const maliciousPath = 'c:\\agent\\home\\directory\\foo.nuspec\n##vso[task.setvariable variable=PATH]c:\\attacker';

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'pack');
tmr.setInput('searchPatternPack', 'foo.nuspec');
tmr.setInput('outputDir', 'C:\\out\\dir');

const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        [maliciousPath]: true
    },
    "which": {},
    "exec": {
        [`c:\\from\\tool\\installer\\nuget.exe pack ${maliciousPath} -NonInteractive -OutputDirectory C:\\out\\dir`]: {
            "code": 0,
            "stdout": "NuGet output here",
            "stderr": ""
        }
    },
    "exist": {
        "C:\\out\\dir": true
    },
    "stats": {
        [maliciousPath]: {
            "isFile": true
        }
    },
    "findMatch": {
        "foo.nuspec": [maliciousPath]
    }
};
nmh.setAnswers(answers);

nmh.registerNugetUtilityMock([maliciousPath]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
nmh.registerNuGetPackUtilsMock(new Date());

tmr.run();