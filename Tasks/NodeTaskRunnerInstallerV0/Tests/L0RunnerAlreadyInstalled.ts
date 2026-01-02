process.env.AGENT_HOMEDIRECTORY = '/fake/agent/home';

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
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.retry = function (func: Function, args: any[], retryOptions: any): any {
    return func.apply(this, args);   
}
tlClone.getVariable = function (variable: string) {
    if (variable.toLowerCase() === 'agent.homedirectory') {
        return '/fake/agent/home';
    }
    if (variable.toLowerCase() === 'agent.tempdirectory') {
        return '/fake/agent/temp';
    }
    return null;
};
tlClone.rmRF = function(path) {
    console.log('Removing ' + path);
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);
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
