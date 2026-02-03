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
        // Return cached path - version is already installed
        console.log(`Found cached tool: ${toolName} version ${version}`);
        return '/mock/cache/func/2.7.1585';
    },
    downloadTool: function(url: string) {
        // Should not be called if cached
        throw new Error('Should not download when cached');
    },
    extractZip: function(downloadPath: string) {
        throw new Error('Should not extract when cached');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        throw new Error('Should not cache when already cached');
    },
    prependPath: function(toolPath: string) {
        console.log(`Prepending to PATH: ${toolPath}`);
    },
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
            'VersionAlreadyInstalled': `Func tool version ${args[0]} is already installed. Installation path: ${args[1]}.`,
            'VerifyingFuncToolsInstallation': 'Verifying func tools installation...',
            'FindingLatestFuncToolsVersion': 'Finding latest func tools version...',
            'LatestFuncToolsVersion': `Latest version is ${args[0]}`
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
    setResult: function(result: any, message: string) { console.log(`Task result: ${result}`); },
    TaskResult: { Succeeded: 0, Failed: 1 },
    warning: function(message: string) { console.log(`Warning: ${message}`); },
    debug: function(message: string) {}
});

tmr.run();
