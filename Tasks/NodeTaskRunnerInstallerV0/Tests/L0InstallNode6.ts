import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import os = require('os');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'index.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.144.0": true
    }
};
tmr.setAnswers(a);

// Create task-lib mock
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getInputRequired = function (inputName: string) {
    if (inputName === 'runnerVersion') {
        return '6';
    }
    return tl.getInputRequired(inputName);
};

tlClone.getVariable = function (variable: string) {
    if (variable.toLowerCase() === 'agent.homedirectory') {
        return '/fake/agent/home';
    }
    return null;
};

tlClone.assertAgent = function (variable: string) {
    return;
};

tmr.registerMock('azure-pipelines-task-lib/task', tlClone);

// Mock os module
tmr.registerMock('os', {
    platform: () => os.platform(),
    arch: () => 'x64'
});

// Mock fs module
tmr.registerMock('fs', {
    existsSync: function (pathToCheck: string): boolean {
        // Simulate runner not installed yet
        return false;
    },
    mkdirSync: function () { },
    writeFileSync: function () { },
    readdirSync: function (): string[] { 
        return []; 
    },
    statSync: function () { 
        return { isDirectory: () => false } as any; 
    },
    copyFileSync: function () { },
    readFileSync: fs.readFileSync,
    constants: fs.constants
});

// Mock tool-lib
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    cleanVersion: function (version: string) {
        return '6.17.1';
    },
    findLocalTool: function (toolName: string, versionSpec: string, arch?: string) {
        if (toolName !== 'node') {
            throw new Error('Searching for wrong tool');
        }
        // Not found in cache
        return '';
    },
    downloadTool: function (url: string) {
        if (url.includes('6.17.1')) {
            return Promise.resolve('/tmp/node-download');
        }
        throw new Error('Incorrect URL');
    },
    extractTar: function (file: string, dest?: string) {
        return Promise.resolve('/tmp/extracted-node');
    },
    extract7z: function (file: string, dest?: string) {
        return Promise.resolve('/tmp/extracted-node');
    },
    cacheDir: function (sourceDir: string, tool: string, version: string, arch?: string) {
        return Promise.resolve('/cache/node/6.17.1/x64');
    }
});

tmr.run();
