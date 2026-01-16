import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'test');
tmr.setInput('projects', 'src\\temp.csproj');
tmr.setInput('publishTestResults', 'false');
tmr.setInput('workingDirectory', 'src');

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'osType': {},
    'checkPath': {
        'c:\\agent\\home\\directory\\sources\\src\\temp.csproj': true,
        'c:\\path\\dotnet.exe': true
    },
    'which': {
        'dotnet': 'c:\\path\\dotnet.exe'
    },
    'exec': {
    'c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\sources\\src\\temp.csproj': {
      'code': 0,
      'stdout': 'dotnet output',
      'stderr': ''
    }
    },
    'exist': {
        'D:\\src\\github\\vsts-tasks\\Tests\\Nuget': true,
        'c:\\agent\\home\\directory\\sources\\src\\global.json': true
    },
    'stats': {
        'c:\\agent\\home\\directory\\sources\\src\\temp.csproj': {
            'isFile': true
        }
    },
    'findMatch': {
        'src\\temp.csproj': ['c:\\agent\\home\\directory\\sources\\src\\temp.csproj']
    }
};
nmh.setAnswers(a);
nmh.registerNugetUtilityMock(['c:\\agent\\home\\directory\\sources\\src\\temp.csproj']);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

// Create mock for fs module
let fs = require('fs');
let fsClone = Object.assign({}, fs);
fsClone.readFileSync = function(filePath, options) {
    switch (filePath) {
        case 'c:\\agent\\home\\directory\\sources\\src\\global.json':
            return '{"test":{"runner":"Microsoft.Testing.Platform"}}';

        default:
            return fs.readFileSync(filePath, options);
    }
};
tmr.registerMock('fs', fsClone);

// Create mock for path module
let pathClone = Object.assign({}, path);
pathClone.resolve = function(...paths: string[]): string {
  if (paths.length === 1) {
    let p = paths[0];
    if (p.startsWith('c:') || p.startsWith('/')) {
      return p;
    }

    return 'c:\\agent\\home\\directory\\sources\\' + p;
  }

  return path.resolve(...paths);
};
tmr.registerMock('path', pathClone);

tmr.run();