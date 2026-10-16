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

// Mock fs
const realFs = require('fs');
tmr.registerMock('fs', {
    writeFileSync: realFs.writeFileSync.bind(realFs),
    existsSync: (p: string) => {
        if (p.endsWith('python.exe')) return true;
        return realFs.existsSync(p);
    },
    statSync: (p: string) => {
        if (p.endsWith('python.exe')) return { isFile: () => true };
        return realFs.statSync(p);
    },
    unlinkSync: realFs.unlinkSync.bind(realFs),
    mkdtempSync: realFs.mkdtempSync.bind(realFs)
});

// Mock telemetry
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`MOCK_TELEMETRY: ${area}, ${feature}, ${JSON.stringify(data)}`);
    }
});

// az is NOT found on PATH
let answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {},
    'checkPath': {}
};
tmr.setAnswers(answers);

tmr.run();
