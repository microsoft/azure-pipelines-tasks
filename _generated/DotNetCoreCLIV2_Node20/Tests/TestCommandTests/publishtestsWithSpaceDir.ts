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
tmr.setInput('BuildConfiguration', 'config');
tmr.setInput('BuildPlatform', 'x86');
tmr.setInput('publishTestResults', 'true');

process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent new\\home\\directory";
process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent new\\home\\directory\\sources",
process.env['AGENT.TEMPDIRECTORY'] = "c:\\agent new\\home\\temp";
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent new\\home\\directory";
process.env['TASK_TEST_TRACE'] = "1";

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'osType': {},
    'checkPath': {
        'c:\\agent new\\home\\directory\\temp.csproj': true,
        'c:\\path\\dotnet.exe': true
    },
    'which': {
        'dotnet': 'c:\\path\\dotnet.exe'
    },
    'exec': {
        'c:\\path\\dotnet.exe test c:\\agent new\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent new\\home\\temp': {
            'code': 0,
            'stdout': 'dotnet output',
            'stderr': ''
        }
    },
    'exist': {
        'D:\\src\\github\\vsts-tasks\\Tests\\Nuget': true
    },
    'stats': {
        'c:\\agent new\\home\\directory\\temp.csproj': {
            'isFile': true
        }
    },
    'findMatch': {
        'temp.csproj': ['c:\\agent new\\home\\directory\\temp.csproj'],
        '**/*.trx': ['c:\\agent new\\home\\temp\\sample.trx']
    },
    "rmRF": {
        "c:\\agent new\\home\\temp\\sample.trx": {
            "success": true
        }
    }
};

// Create mock for getVariable
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    if (variable.toUpperCase() === "Agent.TempDirectory".toUpperCase())
    {
        return process.env[variable.toUpperCase()];
    }
    else
    {
        return tl.getVariable(variable);
    }    
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

nmh.setAnswers(a);
nmh.registerNugetUtilityMock(['c:\\agent new\\home\\directory\\temp.csproj']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
tmr.run();
