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

// Set up environment to simulate Linux environment with dotnet installation
process.env.DOTNET_ROOT = '/usr/share/dotnet';

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'osType': {
        'default': 'Linux'
    },
    'checkPath': {
        '/agent/home/directory/temp.csproj': true,
        '/usr/bin/dotnet': true
    },
    'which': {
        'dotnet': '/usr/bin/dotnet'
    },
    'exec': {
        '/usr/bin/dotnet test /agent/home/directory/temp.csproj': {
            'code': 0,
            'stdout': 'dotnet output with native library test',
            'stderr': ''
        }
    },
    'exist': {
        '/usr/share/dotnet': true,
        '/usr/share/dotnet/shared': true,
        '/usr/share/dotnet/shared/Microsoft.NETCore.App': true,
        '/usr/share/dotnet/shared/Microsoft.NETCore.App/8.0.0': true,
        '/usr/share/dotnet/shared/Microsoft.NETCore.App/9.0.4': true,
        '/usr/bin': true
    },
    'stats': {
        '/agent/home/directory/temp.csproj': {
            'isFile': true
        },
        '/usr/share/dotnet/shared/Microsoft.NETCore.App/8.0.0': {
            'isDirectory': true
        },
        '/usr/share/dotnet/shared/Microsoft.NETCore.App/9.0.4': {
            'isDirectory': true
        }
    },
    'findMatch': {
        'temp.csproj': ['/agent/home/directory/temp.csproj']
    },
    'ls': {
        '/usr/share/dotnet/shared': ['Microsoft.NETCore.App'],
        '/usr/share/dotnet/shared/Microsoft.NETCore.App': ['8.0.0', '9.0.4']
    }
};

nmh.setAnswers(a);
nmh.registerNugetUtilityMock(['/agent/home/directory/temp.csproj']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
tmr.run();