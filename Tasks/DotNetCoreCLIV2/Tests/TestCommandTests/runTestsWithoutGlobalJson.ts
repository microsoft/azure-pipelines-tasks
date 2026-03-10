import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

const repoRoot = path.join('agent','home','directory','sources');
const dotnetPath = path.join('path','dotnet');

const projectPath = path.join(repoRoot,'src','app','temp.csproj');

const taskPath = path.join(__dirname,'../..','dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();

tmr.setInput('command','test');
tmr.setInput('projects', path.join('src','app','temp.csproj'));
tmr.setInput('publishTestResults','false');
tmr.setInput('workingDirectory','src/app');

const answers: ma.TaskLibAnswers = {
    osType: {},
    checkPath: {
        [projectPath]: true,
        [dotnetPath]: true
    },
    which: {
        dotnet: dotnetPath
    },
    exec: {
        [`${dotnetPath} test ${projectPath}`]: { code:0, stdout:'', stderr:'' },
        [`"${dotnetPath}" test "${projectPath}"`]: { code:0, stdout:'', stderr:'' }
    },

    // intentionally empty → simulate no global.json anywhere
    exist: {},

    stats: {
        [projectPath]: { isFile: true }
    },
    findMatch: {
        [path.join('src','app','temp.csproj')]: [projectPath]
    }
};

nmh.setAnswers(answers);

nmh.registerNugetUtilityMock([projectPath]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

const fs = require('fs');
const fsClone = { ...fs };

tmr.registerMock('fs', fsClone);

tmr.run();