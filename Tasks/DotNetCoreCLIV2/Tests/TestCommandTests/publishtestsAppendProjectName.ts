import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

// Two test projects with 'appendToTestRunTitle: projectName'. Each project must get its own
// results directory and be published under '<testRunTitle> <project name>'.

// Use platform-appropriate absolute paths so path.join()/path.relative() behave on all platforms.
const isWin = process.platform === 'win32';
const homeDir = isWin ? 'c:\agent\home\directory' : '/agent/home/directory';
const tempDir = isWin ? 'c:\agent\home\temp' : '/agent/home/temp';
const dotnetPath = isWin ? 'c:\path\dotnet.exe' : '/path/dotnet';

const sourcesDir = path.join(homeDir, 'sources');
const alphaProject = path.join(sourcesDir, 'Alpha.Tests', 'Alpha.Tests.csproj');
const betaProject = path.join(sourcesDir, 'Beta.Tests', 'Beta.Tests.csproj');
const trxFile = path.join(tempDir, 'sample.trx');

const taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
const nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

process.env['AGENT.TEMPDIRECTORY'] = tempDir;
process.env['BUILD_SOURCESDIRECTORY'] = sourcesDir;
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = homeDir;

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'test');
tmr.setInput('projects', `${alphaProject}\n${betaProject}`);
tmr.setInput('publishTestResults', 'true');
tmr.setInput('testRunTitle', 'My Tests');
tmr.setInput('appendToTestRunTitle', 'projectName');

const a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'osType': {},
    'checkPath': {
        [alphaProject]: true,
        [betaProject]: true,
        [dotnetPath]: true
    },
    'which': {
        'dotnet': dotnetPath
    },
    'exec': {
        [`${dotnetPath} test ${alphaProject} --logger trx --results-directory ${path.join(tempDir, 'TestResults_0')}`]: {
            'code': 0,
            'stdout': 'alpha output',
            'stderr': ''
        },
        [`${dotnetPath} test ${betaProject} --logger trx --results-directory ${path.join(tempDir, 'TestResults_1')}`]: {
            'code': 0,
            'stdout': 'beta output',
            'stderr': ''
        }
    },
    'exist': {},
    'stats': {
        [alphaProject]: { 'isFile': true },
        [betaProject]: { 'isFile': true }
    },
    'findMatch': {
        [`${alphaProject}\n${betaProject}`]: [alphaProject, betaProject],
        '**/*.trx': [trxFile]
    },
    'rmRF': {
        [trxFile]: { 'success': true }
    }
};

// Create mock for getVariable
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function (variable: string) {
    if (variable.toUpperCase() === "Agent.TempDirectory".toUpperCase()) {
        return process.env[variable.toUpperCase()];
    }
    else {
        return tl.getVariable(variable);
    }
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

nmh.setAnswers(a);
nmh.registerNugetUtilityMock([alphaProject, betaProject]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();
tmr.run();
