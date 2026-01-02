import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import os = require('os');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'index.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('runnerVersion', '10');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.144.0": true
    }
};
tmr.setAnswers(a);

// Create task-lib mock
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

tlClone.getVariable = function (variable: string) {
    if (variable.toLowerCase() === 'agent.homedirectory') {
        return '/fake/agent/home';
    }
    return null;
};

tlClone.assertAgent = function (variable: string) {
    return;
};

tlClone.loc = function (key: string, ...args: any[]) {
    return key;
};

tlClone.setResourcePath = function (path: string) {
    return;
};

tlClone.rmRF = function (path: string) {
    return;
};

tlClone.mkdirP = function (path: string) {
    return;
};

tlClone.retry = async function (fn: () => Promise<any>) {
    return await fn();
};

tlClone.debug = function (message: string) {
    console.log('##vso[task.debug]' + message);
};

tlClone.cp = function (source: string, dest: string, options?: string) {
    return;
};

tlClone.warning = function (message: string) {
    console.log('##vso[task.warning]' + message);
};

tmr.registerMock('azure-pipelines-task-lib/task', tlClone);

// Mock os module
tmr.registerMock('os', {
    platform: () => os.platform(),
    arch: () => 'x64'
});

// Mock fs module - runner already installed
tmr.registerMock('fs', {
    existsSync: function (pathToCheck: string): boolean {
        // Simulate runner already installed at externals/node10/bin/node
        if (pathToCheck.includes('node10') && pathToCheck.includes('bin')) {
            return true;
        }
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
        return '10.24.1';
    },
    findLocalTool: function (toolName: string, versionSpec: string, arch?: string) {
        // Should not be called if runner already installed
        return '';
    }
});

tmr.run();
