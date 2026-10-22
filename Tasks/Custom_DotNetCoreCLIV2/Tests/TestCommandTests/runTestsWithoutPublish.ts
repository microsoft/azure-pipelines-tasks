import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'test');
tmr.setInput('projects', 'temp.csproj');
tmr.setInput('publishTestResults', 'false');

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'osType': {},
    'checkPath': {
        'c:\\agent\\home\\directory\\temp.csproj': true,
        'c:\\path\\dotnet.exe': true
    },
    'which': {
        'dotnet': 'c:\\path\\dotnet.exe'
    },
    'exec': {
        'c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj': {
            'code': 0,
            'stdout': 'dotnet output',
            'stderr': ''
        }
    },
    'exist': {
        'D:\\src\\github\\vsts-tasks\\Tests\\Nuget': true
    },
    'stats': {
        'c:\\agent\\home\\directory\\temp.csproj': {
            'isFile': true
        }
    },
    'findMatch': {
        'temp.csproj': ['c:\\agent\\home\\directory\\temp.csproj']
    }
};
nmh.setAnswers(a);
nmh.registerNugetUtilityMock(['c:\\agent\\home\\directory\\temp.csproj']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
tmr.run();
