import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import * as fs from 'fs';

const tempDir = path.join(__dirname, '_temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

process.env['AGENT_TEMPDIRECTORY'] = tempDir;
process.env['SYSTEM_JOBID'] = 'test-job-id';

let taskPath = path.join(__dirname, '..', 'src', 'functoolsinstaller.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Invalid version format
tmr.setInput('version', 'invalid-version');

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null;
    },
    downloadTool: function(url: string) {
        throw new Error('Should not attempt download with invalid version');
    },
    cleanVersion: function(version: string) {
        // Return null/undefined for invalid versions
        console.log(`cleanVersion called with: ${version}`);
        return null;
    }
});

tmr.registerMock('fs', {
    ...fs,
    chmodSync: function(p: string, mode: string) {},
    existsSync: function(filePath: string) {
        return fs.existsSync(filePath);
    }
});

tmr.registerMock('azure-pipelines-task-lib/task', {
    getInput: function(name: string, required?: boolean) {
        if (name === 'version') return 'invalid-version';
        return null;
    },
    getVariable: function(name: string) {
        if (name === 'SYSTEM_JOBID') return 'test-job-id';
        return null;
    },
    setResourcePath: function(p: string) {},
    loc: function(key: string, ...args: any[]) {
        const messages: {[key: string]: string} = {
            'NotAValidSemverVersion': 'Version not specified in correct format. Ex: 2.7.1575, v2.7.1575, latest',
            'VerifyingFuncToolsInstallation': 'Verifying func tools installation...'
        };
        return messages[key] || key;
    },
    which: function(tool: string, check?: boolean) { return '/mock/path/func'; },
    tool: function(toolPath: string) {
        return {
            arg: function(a: string) { return this; },
            exec: function() { return Promise.resolve(0); }
        };
    },
    setResult: function(result: any, message: string) {
        console.log(`Task result: ${result} - ${message}`);
    },
    TaskResult: { Succeeded: 0, Failed: 1 },
    warning: function(message: string) { console.log(`Warning: ${message}`); },
    debug: function(message: string) {}
});

tmr.run();
