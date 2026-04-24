import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'test');
tmr.setInput('projects', 'solution.slnx');
tmr.setInput('publishTestResults', 'false');

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'osType': {},
    'checkPath': {
        'c:\\agent\\home\\directory\\solution.slnx': true,
        'c:\\path\\dotnet.exe': true
    },
    'which': {
        'dotnet': 'c:\\path\\dotnet.exe'
    },
    'exec': {
        'c:\\path\\dotnet.exe test --solution c:\\agent\\home\\directory\\solution.slnx': {
            'code': 0,
            'stdout': 'dotnet output',
            'stderr': ''
        }
    },
    'exist': {},
    'stats': {
        'c:\\agent\\home\\directory\\solution.slnx': {
            'isFile': true
        }
    },
    'findMatch': {
        'solution.slnx': ['c:\\agent\\home\\directory\\solution.slnx']
    }
};
nmh.setAnswers(a);
nmh.registerNugetUtilityMock(['c:\\agent\\home\\directory\\solution.slnx']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();
