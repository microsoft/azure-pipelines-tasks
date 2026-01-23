import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import os = require('os');

const taskPath = path.join(__dirname, '..', 'src', 'dockertoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput('dockerVersion', '17.09.0-ce');
tr.setInput('releaseType', 'stable');

// Set environment variables
process.env['AGENT_TEMPDIRECTORY'] = 'C:\\temp';
process.env['AGENT_TOOLSDIRECTORY'] = 'C:\\temp\\tools';

// Determine platform-specific values
const isWindows = os.type().match(/^Win/);
const dockerExecutable = isWindows ? 'docker.exe' : 'docker';
const cachedToolPath = isWindows ? 'C:\\temp\\tools\\docker-stable\\17.9.0-ce\\x64' : '/tmp/tools/docker-stable/17.9.0-ce/x64';
const dockerPath = isWindows ? `${cachedToolPath}\\${dockerExecutable}` : `${cachedToolPath}/${dockerExecutable}`;
const dockerWhichPath = isWindows ? 'C:\\Program Files\\Docker\\docker.exe' : '/usr/bin/docker';

// Mock answers
const answers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'which': {
        'docker': dockerWhichPath
    },
    'checkPath': {
        [dockerWhichPath]: true
    },
    'exec': {
        [`${dockerWhichPath} --version`]: {
            'code': 0,
            'stdout': 'Docker version 17.09.0-ce, build afdb6d4'
        }
    },
    'exist': {
        [cachedToolPath]: true,
        [dockerPath]: true
    },
    'find': {
        [cachedToolPath]: [dockerPath]
    },
    'match': {
        [dockerPath]: [dockerPath]
    }
};

tr.setAnswers(answers);

// Mock azure-pipelines-tool-lib/tool
tr.registerMock('azure-pipelines-tool-lib/tool', {
    findLocalTool: function(toolName: string, version: string) {
        console.log(`findLocalTool called with ${toolName}, ${version}`);
        return cachedToolPath;
    },
    prependPath: function(toolPath: string) {
        console.log(`Prepending path: ${toolPath}`);
    },
    downloadTool: async function(url: string, fileName: string) {
        console.log(`downloadTool called with ${url}`);
        return isWindows ? 'C:\\temp\\docker-download.zip' : '/tmp/docker-download.tgz';
    },
    extractTar: async function(archivePath: string) {
        console.log(`extractTar called with ${archivePath}`);
        return isWindows ? 'C:\\temp\\extracted' : '/tmp/extracted';
    },
    extractZip: async function(archivePath: string) {
        console.log(`extractZip called with ${archivePath}`);
        return isWindows ? 'C:\\temp\\extracted' : '/tmp/extracted';
    },
    cacheFile: async function(sourceFile: string, destFileName: string, tool: string, version: string) {
        console.log(`cacheFile called`);
        return cachedToolPath;
    }
});

// Mock the utils module
tr.registerMock('./utils', {
    downloadDocker: async function(version: string, releaseType: string) {
        console.log(`Mock downloadDocker called with ${version}, ${releaseType}`);
        return dockerPath;
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
        return true;
    },
    statSync: function(filePath: string) {
        return { isDirectory: () => false, isFile: () => true };
    },
    readFileSync: fs.readFileSync
});

tr.run();
