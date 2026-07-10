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

tmr.setInput('version', '2.7.1585');

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return '/mock/cache/func/2.7.1585';
    },
    prependPath: function(toolPath: string) {},
    cleanVersion: function(version: string) {
        return version.replace(/^v/, '');
    }
});

tmr.registerMock('fs', {
    ...fs,
    chmodSync: function(p: string, mode: string) {},
    existsSync: function(filePath: string) {
        if (filePath.includes('gozip')) return false;
        return fs.existsSync(filePath);
    }
});

let verificationCalled = false;

tmr.registerMock('azure-pipelines-task-lib/task', {
    getInput: function(name: string, required?: boolean) {
        if (name === 'version') return '2.7.1585';
        return null;
    },
    getVariable: function(name: string) {
        if (name === 'SYSTEM_JOBID') return 'test-job-id';
        return null;
    },
    setResourcePath: function(p: string) {},
    loc: function(key: string, ...args: any[]) {
        const messages: {[key: string]: string} = {
            'SuccessfullyDownloaded': `Successfully downloaded func tools ${args[0]}.`,
            'VersionAlreadyInstalled': `Func tool version ${args[0]} is already installed.`,
            'VerifyingFuncToolsInstallation': 'Verifying func tools installation...'
        };
        if (key === 'VerifyingFuncToolsInstallation') {
            verificationCalled = true;
        }
        return messages[key] || key;
    },
    which: function(tool: string, check?: boolean) {
        console.log(`Looking for tool: ${tool}`);
        return '/mock/path/func';
    },
    tool: function(toolPath: string) {
        console.log(`Creating tool runner for: ${toolPath}`);
        return {
            arg: function(a: string) {
                console.log(`Adding argument: ${a}`);
                return this;
            },
            exec: function() {
                console.log('Executing func --version');
                return Promise.resolve(0);
            }
        };
    },
    setResult: function(result: any, message: string) {
        console.log(`Task result: ${result}`);
        if (verificationCalled) {
            console.log('Verification was performed');
        }
    },
    TaskResult: { Succeeded: 0, Failed: 1 },
    warning: function(message: string) { console.log(`Warning: ${message}`); },
    debug: function(message: string) {}
});

tmr.run();
