import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

let taskPath = path.join(__dirname, 'L0AzModuleFlagOff_task.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Inputs that getPowerShellScriptPath reads
tmr.setInput('powerShellErrorActionPreference', 'Stop');
tmr.setInput('inlineScript', 'az account show');
tmr.setInput('scriptPath', '');
tmr.setInput('powerShellIgnoreLASTEXITCODE', 'false');

// Environment — FF is OFF
process.env['AGENT_TEMPDIRECTORY'] = os.tmpdir();
delete process.env['DISTRIBUTEDTASK_TASKS_AZURECLIUSEFILEINVOCATION'];

// Mock fs — pass through writes, capture wrapper script content
const realFs = require('fs');
tmr.registerMock('fs', {
    writeFileSync: (filePath: string, data: string, options?: any) => {
        realFs.writeFileSync(filePath, data, options);
        if (filePath.includes('azureclitaskscript') && !filePath.includes('_inlinescript')) {
            console.log('WRAPPER_SCRIPT_CONTENT_START');
            console.log(data);
            console.log('WRAPPER_SCRIPT_CONTENT_END');
        }
    },
    existsSync: realFs.existsSync.bind(realFs),
    unlinkSync: realFs.unlinkSync.bind(realFs)
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
