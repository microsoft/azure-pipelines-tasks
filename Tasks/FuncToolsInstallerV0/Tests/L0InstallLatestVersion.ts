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

// Set inputs - latest version
tmr.setInput('version', 'latest');

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null;
    },
    downloadTool: function(url: string) {
        console.log(`Downloading from: ${url}`);
        // Mock API response for latest version
        if (url.includes('api.github.com')) {
            const mockResponsePath = path.join(tempDir, 'github-response.json');
            fs.writeFileSync(mockResponsePath, JSON.stringify({ tag_name: '4.0.5000' }));
            return Promise.resolve(mockResponsePath);
        }
        return Promise.resolve('/mock/download/func.zip');
    },
    extractZip: function(downloadPath: string) {
        return Promise.resolve('/mock/extract/path');
    },
    cacheDir: function(sourceDir: string, tool: string, version: string) {
        console.log(`Caching tool: ${tool} version: ${version}`);
        return Promise.resolve(`/mock/cache/func/${version}`);
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
    },
    readFileSync: function(filePath: string, encoding?: string) {
        if (filePath.includes('github-response')) {
            return JSON.stringify({ tag_name: '4.0.5000' });
        }
        return fs.readFileSync(filePath, encoding as BufferEncoding);
    }
});

tmr.registerMock('azure-pipelines-task-lib/task', {
    getInput: function(name: string, required?: boolean) {
        if (name === 'version') return 'latest';
        return null;
    },
    getVariable: function(name: string) {
        if (name === 'SYSTEM_JOBID') return 'test-job-id';
        return null;
    },
    setResourcePath: function(p: string) {},
    loc: function(key: string, ...args: any[]) {
        const messages: {[key: string]: string} = {
            'SuccessfullyDownloaded': `Successfully downloaded func tools ${args[0]}. Download path: ${args[1]}.`,
            'VersionAlreadyInstalled': `Func tool version ${args[0]} is already installed.`,
            'VerifyingFuncToolsInstallation': 'Verifying func tools installation...',
            'FindingLatestFuncToolsVersion': 'Finding latest func tools version...',
            'LatestFuncToolsVersion': `Latest version is ${args[0]}`,
            'NotAValidSemverVersion': 'Version not specified in correct format.',
            'FuncDownloadFailed': `Failed to download func tools.`,
            'ErrorFetchingLatestVersion': `Error fetching latest version. Using default: ${args[2]}.`
        };
        return messages[key] || key;
    },
    which: function(tool: string, check?: boolean) {
        return '/mock/path/func';
    },
    tool: function(toolPath: string) {
        return {
            arg: function(a: string) { return this; },
            exec: function() { return Promise.resolve(0); }
        };
    },
    setResult: function(result: any, message: string) {
        console.log(`Task result: ${result}`);
    },
    TaskResult: { Succeeded: 0, Failed: 1 },
    warning: function(message: string) { console.log(`Warning: ${message}`); },
    debug: function(message: string) {}
});

tmr.run();
