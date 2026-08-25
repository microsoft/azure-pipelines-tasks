import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, 'L0AzModuleInjection_task.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Inputs that getPowerShellScriptPathWithAzModule reads
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

// Mock fs — pass through writes, override existsSync/statSync for python.exe, mkdtempSync
const realFs = require('fs');
let mkdtempDir: string = null;
tmr.registerMock('fs', {
    writeFileSync: (filePath: string, data: string, options?: any) => {
        realFs.writeFileSync(filePath, data, options);
        if (filePath.includes('azureclitaskscript') && !filePath.includes('_inlinescript')) {
            console.log('WRAPPER_SCRIPT_CONTENT_START');
            console.log(data);
            console.log('WRAPPER_SCRIPT_CONTENT_END');
        }
        if (filePath.endsWith('az.ps1')) {
            console.log('SHIM_SCRIPT_CONTENT_START');
            console.log(data);
            console.log('SHIM_SCRIPT_CONTENT_END');
        }
    },
    existsSync: (p: string) => {
        if (p.endsWith('python.exe')) return true;
        return realFs.existsSync(p);
    },
    statSync: (p: string) => {
        if (p.endsWith('python.exe')) return { isFile: () => true };
        return realFs.statSync(p);
    },
    unlinkSync: realFs.unlinkSync.bind(realFs),
    mkdtempSync: (prefix: string) => {
        mkdtempDir = realFs.mkdtempSync(prefix);
        console.log('MKDTEMP_CALLED:' + mkdtempDir);
        return mkdtempDir;
    }
});

// Mock telemetry — capture calls
tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`MOCK_TELEMETRY: ${area}, ${feature}, ${JSON.stringify(data)}`);
    }
});

// Mock answers
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
