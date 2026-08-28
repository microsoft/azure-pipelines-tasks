import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, 'L0AzModuleShimWriteFailure_task.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('powerShellErrorActionPreference', 'Stop');
tmr.setInput('inlineScript', 'az account show');
tmr.setInput('scriptPath', '');
tmr.setInput('powerShellIgnoreLASTEXITCODE', 'false');

process.env['AGENT_TEMPDIRECTORY'] = os.tmpdir();

tmr.registerMock('os', {
    platform: () => 'win32',
    tmpdir: () => os.tmpdir(),
    EOL: os.EOL
});

const realFs = require('fs');
let rmRFCalled: string[] = [];
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
    mkdtempSync: () => {
        throw new Error('ENOSPC: no space left on device');
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`MOCK_TELEMETRY: ${area}, ${feature}, ${JSON.stringify(data)}`);
    }
});

// Mock tl.rmRF used by Utility.deleteDirectory
tmr.registerMock('azure-pipelines-task-lib/task', (() => {
    const realTl = require('azure-pipelines-task-lib/mock-task');
    const original = { ...realTl };
    original.rmRF = (p: string) => {
        console.log('RMRF_CALLED:' + p);
    };
    return original;
})());

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
