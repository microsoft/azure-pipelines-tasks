import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

// ------------------------------------------------------------
// Paths
// ------------------------------------------------------------
const repoRoot = path.join('agent', 'home', 'directory', 'sources');
const dotnetPath = path.join('path', 'dotnet');
const projectPath = path.join(repoRoot, 'src', 'temp.csproj');
const globalJsonPath = path.join(repoRoot, 'src', 'global.json');


// ------------------------------------------------------------
// Task runner setup
// ------------------------------------------------------------
const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();

tmr.setInput('command', 'test');
tmr.setInput('projects', path.join('src', 'temp.csproj'));
tmr.setInput('publishTestResults', 'false');
tmr.setInput('workingDirectory', 'src');

// ------------------------------------------------------------
// Mock answers
// ------------------------------------------------------------
const a: ma.TaskLibAnswers = {
    osType: {}, 
    checkPath: {
        [projectPath]: true,
        [dotnetPath]: true
    },
    which: {
        dotnet: dotnetPath
    },
    exec: {
        [`${dotnetPath} test ${projectPath}`]: {
            code: 0,
            stdout: 'dotnet output',
            stderr: ''
        },
        [`"${dotnetPath}" test "${projectPath}"`]: {
            code: 0,
            stdout: 'dotnet output',
            stderr: ''
        }
    },
    exist: {
        [globalJsonPath]: true
    },
    stats: {
        [projectPath]: { isFile: true }
    },
    findMatch: {
    [path.join('src', 'temp.csproj')]: [projectPath]
   }
};

nmh.setAnswers(a);

// ------------------------------------------------------------
// Standard mocks
// ------------------------------------------------------------
nmh.registerNugetUtilityMock([projectPath]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

// ------------------------------------------------------------
// fs mock for global.json
// ------------------------------------------------------------
const fs = require('fs');
const fsClone = { ...fs };

fsClone.readFileSync = function (filePath: string) {
    if (filePath === globalJsonPath) {
        return '{"test":{"runner":"Microsoft.Testing.Platform"}}';
    }
    return fs.readFileSync(filePath);
};

tmr.registerMock('fs', fsClone);

// ------------------------------------------------------------
// Run
// ------------------------------------------------------------
tmr.run();
