import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

const repoRoot = 'c:\\agent\\home\\directory\\sources';
const dotnetPath = 'c:\\path\\dotnet';

const projectPath = path.join(repoRoot, 'src', 'app', 'temp.csproj');
const globalJsonPath = path.join(repoRoot, 'src', 'global.json');

const taskPath = path.join(__dirname, '..', '..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();

tmr.setInput('command', 'test');
tmr.setInput('projects', 'src/app/temp.csproj');
tmr.setInput('publishTestResults', 'false');
tmr.setInput('workingDirectory', 'src/app');

tmr.setVariable('Build.SourcesDirectory', repoRoot);

const answers: ma.TaskLibAnswers = {
    osType: {},
    which: {
        dotnet: dotnetPath
    },
    checkPath: {
        [projectPath]: true,
        [dotnetPath]: true
    },
    exist: {
        [projectPath]: true,
        [globalJsonPath]: true
    },
    stats: {
        [projectPath]: { isFile: true },
        [globalJsonPath]: { isFile: true }
    },
    findMatch: {
        'src/app/temp.csproj': [projectPath]
    },
    exec: {
        [`${dotnetPath} test ${projectPath}`]: { code: 0, stdout: '', stderr: '' },
        [`"${dotnetPath}" test "${projectPath}"`]: { code: 0, stdout: '', stderr: '' }
    }
};

nmh.setAnswers(answers);

nmh.registerNugetUtilityMock([projectPath]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

const fs = require('fs');
const fsClone = { ...fs };

fsClone.readFileSync = function (filePath: string) {
    if (filePath === globalJsonPath) {
        return '{"test":{"runner":"Microsoft.Testing.Platform"}}';
    }
    return fs.readFileSync(filePath);
};

tmr.registerMock('fs', fsClone);

tmr.run();