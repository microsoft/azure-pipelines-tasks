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
let createdTempDir: string = null;
tmr.registerMock('fs', {
    writeFileSync: (filePath: string, data: string, options?: any) => {
        if (filePath.endsWith('az.ps1')) {
            throw new Error('EACCES: permission denied, open az.ps1');
        }
        realFs.writeFileSync(filePath, data, options);
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
        createdTempDir = realFs.mkdtempSync(prefix);
        console.log('MKDTEMP_CREATED:' + createdTempDir);
        process.env['TEST_SHIM_DIR'] = createdTempDir;
        return createdTempDir;
    }
});

tmr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: (area: string, feature: string, data: any) => {
        console.log(`MOCK_TELEMETRY: ${area}, ${feature}, ${JSON.stringify(data)}`);
    }
});

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
