import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'gotool.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const testCase = process.env['__case__'];

// Configure inputs depending on scenario
switch (testCase) {
    case 'useGoModSingle':
        tmr.setInput('useGoMod', 'true');
        tmr.setInput('workingDirectory', 'work');
        break;
    case 'useGoModMulti':
        tmr.setInput('useGoMod', 'true');
        tmr.setInput('workingDirectory', 'repo');
        break;
    case 'useGoModNotFound':
        tmr.setInput('useGoMod', 'true');
        tmr.setInput('workingDirectory', 'empty');
        break;
    case 'explicitVersion':
        tmr.setInput('useGoMod', 'false');
        tmr.setInput('version', '1.21.0');
        break;
    default:
        throw new Error('Unknown __case__ value: ' + testCase);
}

const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'assertAgent': { '2.115.0': true }
};
tmr.setAnswers(answers);

// Dynamic findMatch behavior based on test case
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.findMatch = function(root: string, pattern: string) {
    if (pattern !== '**/go.mod') return [];
    if (testCase === 'useGoModSingle' && root === 'work') {
        return ['work/go.mod'];
    }
    if (testCase === 'useGoModMulti' && root === 'repo') {
        return ['repo/a/go.mod', 'repo/b/go.mod'];
    }
    if (testCase === 'useGoModNotFound') {
        return [];
    }
    return [];
};
tlClone.getVariable = function(v: string) {
    if (v.toLowerCase() === 'system.defaultworkingdirectory') {
        if (testCase === 'useGoModSingle') return 'work';
        if (testCase === 'useGoModMulti') return 'repo';
        if (testCase === 'useGoModNotFound') return 'empty';
    }
    if (v.toLowerCase() === 'agent.tempdirectory') return 'temp';
    return null;
};
tlClone.assertAgent = function() { return; };
tlClone.loc = function(locString: string, ...params: any[]) { return locString + ' ' + params.join(' '); };
tlClone.prependPath = function(p: string) { /* no-op for tests */ };
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// fs mock
tmr.registerMock('fs', {
    readFileSync: function(p: string) {
        if (p === 'work/go.mod') return Buffer.from('module example.com/single\n\n go 1.22');
        if (p === 'repo/a/go.mod') return Buffer.from('module example.com/a\n go 1.21');
        if (p === 'repo/b/go.mod') return Buffer.from('module example.com/b\n go 1.22');
        return Buffer.from('');
    }
});

// tool-lib mock
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(tool: string, version: string) { return false; },
    downloadTool: function(url: string) { return 'download'; },
    extractTar: function(downloadPath: string) { return 'ext'; },
    extractZip: function(downloadPath: string) { return 'ext'; },
    cacheDir: function(dir: string, tool: string, version: string) { return path.join('cache', tool, version); },
    prependPath: function(p: string) { /* no-op */ }
});

tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', { emitTelemetry: function() {} });

tmr.run();
