import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, 'L0AzModuleInjection_task.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Inputs
tmr.setInput('powerShellErrorActionPreference', 'Stop');
tmr.setInput('inlineScript', 'az account show');
tmr.setInput('scriptPath', '');
tmr.setInput('powerShellIgnoreLASTEXITCODE', 'false');

// Environment
process.env['AGENT_TEMPDIRECTORY'] = os.tmpdir();

// Mock os to always return win32
tmr.registerMock('os', {
    platform: () => 'win32',
    tmpdir: () => os.tmpdir(),
    EOL: os.EOL
});

// Mock fs — python.exe does NOT exist
const realFs = require('fs');
tmr.registerMock('fs', {
    writeFileSync: realFs.writeFileSync.bind(realFs),
    existsSync: (p: string) => {
        if (p.endsWith('python.exe')) return false;
        return realFs.existsSync(p);
    },
    statSync: realFs.statSync.bind(realFs),
    unlinkSync: realFs.unlinkSync.bind(realFs),
    mkdtempSync: realFs.mkdtempSync.bind(realFs)
});

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`MOCK_TELEMETRY: ${area}, ${feature}, ${JSON.stringify(data)}`);
    }
});

// az IS found but python.exe is not
let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
        'az': 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd'
    },
    'checkPath': {
        'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd': true
    }
};
tmr.setAnswers(answers);

tmr.run();
