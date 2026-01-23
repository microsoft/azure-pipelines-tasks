import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

const taskPath = path.join(__dirname, '..', 'src', 'dockertoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs - use invalid version to trigger failure
tr.setInput('dockerVersion', '99.99.99-ce');
tr.setInput('releaseType', 'stable');

// Determine platform-specific values
const isWindows = os.type().match(/^Win/);

// Set environment variables based on platform
process.env['AGENT_TEMPDIRECTORY'] = isWindows ? 'C:\\temp' : '/tmp';
process.env['AGENT_TOOLSDIRECTORY'] = isWindows ? 'C:\\temp\\tools' : '/tmp/tools';

// Mock answers - empty/minimal to simulate failure
const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {},
    'checkPath': {},
    'exec': {},
    'exist': {},
    'find': {},
    'match': {}
};

tr.setAnswers(answers);

// Mock the utils module - simulate download failure
tr.registerMock('./utils', {
    downloadDocker: async function(version: string, releaseType: string) {
        throw new Error(`Failed to download docker version ${version}`);
    }
});

// Mock azure-pipelines-tool-lib/tool - simulate cache miss and download failure
tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        return null; // Tool not cached
    },
    prependPath: function(toolPath: string) {
        console.log(`Prepending path: ${toolPath}`);
    },
    downloadTool: async function(url: string, fileName: string) {
        throw new Error(`Failed to download docker from ${url}`);
    },
    extractTar: async function(archivePath: string) {
        return '/tmp/extracted';
    },
    extractZip: async function(archivePath: string) {
        return 'C:\\temp\\extracted';
    },
    cacheFile: async function(sourceFile: string, destFileName: string, tool: string, version: string) {
        return 'C:\\temp\\tools\\docker';
    }
});

// Mock fs module
import fs = require('fs');
tr.registerMock('fs', {
    ...fs,
    chmodSync: function(filePath: string, mode: string) {
        console.log(`chmod ${mode} ${filePath}`);
    },
    existsSync: function(filePath: string) {
        return false;
    },
    readFileSync: fs.readFileSync
});

tr.run();
