import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');
import util = require('../DotnetMockHelper');

// Simulate AZP_AGENT_ALLOW_WORK_DIRECTORY_REPOSITORIES=true scenario:
//   Agent.WorkFolder    = <workDir>           (e.g., _work/)
//   Agent.BuildDirectory = <workDir>/1        (e.g., _work/1)
//   workingDirectory     = <workDir>/shared   (checkout with path: ../shared)
//
// The repo is checked out outside Agent.BuildDirectory but inside Agent.WorkFolder.
// With the knob enabled, boundary widens to Agent.WorkFolder and global.json is found.

// Use a real temp directory as the work folder base so the task-lib vault can initialize.
const workDir = path.join(os.tmpdir(), 'agent-work-test');
const buildDir = path.join(workDir, '1');
const sharedDir = path.join(workDir, 'shared');
const dotnetPath = path.join('path', 'dotnet');

const projectPath = path.join(sharedDir, 'MySolution.slnx');
const globalJsonPath = path.join(sharedDir, 'global.json');

// Ensure the work directory exists for vault initialization
const fs = require('fs');
if (!fs.existsSync(workDir)) { fs.mkdirSync(workDir, { recursive: true }); }

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

// Simulate the knob and directory layout
process.env['AZP_AGENT_ALLOW_WORK_DIRECTORY_REPOSITORIES'] = 'true';
process.env['AGENT_WORKFOLDER'] = workDir;
process.env['AGENT_BUILDDIRECTORY'] = buildDir;
process.env['BUILD_SOURCESDIRECTORY'] = path.join(buildDir, 's');
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = path.join(buildDir, 's');

nmh.setNugetVersionInputDefault();

tmr.setInput('command', 'test');
tmr.setInput('projects', projectPath);
tmr.setInput('publishTestResults', 'false');
tmr.setInput('workingDirectory', sharedDir);

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
        [`${dotnetPath} test --solution ${projectPath}`]: { code: 0, stdout: '', stderr: '' },
        [`"${dotnetPath}" test --solution "${projectPath}"`]: { code: 0, stdout: '', stderr: '' }
    },
    exist: {
        [globalJsonPath]: true
    },
    stats: {
        [projectPath]: { isFile: true }
    },
    findMatch: {
        [projectPath]: [projectPath]
    }
};

nmh.setAnswers(answers);

nmh.registerNugetUtilityMock([projectPath]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

const fsClone = { ...fs };

fsClone.readFileSync = function (filePath: string) {
    if (filePath === globalJsonPath) {
        return '{"test":{"runner":"Microsoft.Testing.Platform"}}';
    }
    return fs.readFileSync(filePath);
};

tmr.registerMock('fs', fsClone);
tmr.run();
