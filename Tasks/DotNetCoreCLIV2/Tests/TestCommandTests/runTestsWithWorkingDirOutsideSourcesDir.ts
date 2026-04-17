import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

// Simulate multi-repo checkout scenario (issue #21989):
//   Build.SourcesDirectory         = <buildDir>/s          (default, stays in multi-repo)
//   System.DefaultWorkingDirectory = <buildDir>/s          (same in multi-repo)
//   Agent.BuildDirectory           = <buildDir>
//   workingDirectory               = <buildDir>/repository (custom checkout path)
//
// global.json with MTP config is at <buildDir>/repository/global.json
// The fix should find it via the Agent.BuildDirectory fallback and add --solution.

// Use platform-appropriate absolute paths so path.resolve() is a no-op on all platforms.
const isWin = process.platform === 'win32';
const buildDir = isWin ? 'c:\\agent\\work\\1' : '/tmp/agent/work/1';
const sourcesDir = path.join(buildDir, 's');
const repoDir = path.join(buildDir, 'repository');
const dotnetPath = path.join('path', 'dotnet');

const projectPath = path.join(repoDir, 'MySolution.slnx');
const globalJsonPath = path.join(repoDir, 'global.json');

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

// Override env vars to simulate multi-repo checkout (after DotnetMockHelper)
process.env['BUILD_SOURCESDIRECTORY'] = sourcesDir;
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = sourcesDir;
process.env['AGENT_BUILDDIRECTORY'] = buildDir;

nmh.setNugetVersionInputDefault();

tmr.setInput('command', 'test');
tmr.setInput('projects', projectPath);
tmr.setInput('publishTestResults', 'false');
tmr.setInput('workingDirectory', repoDir);

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