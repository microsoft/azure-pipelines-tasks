process.env.AGENT_HOMEDIRECTORY = '/fake/agent/home';

import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import fs = require('fs');
import os = require('os');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'index.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('runnerVersion', '6');

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

tmr.registerMock('os', {
    platform: () => os.platform(),
    arch: () => 'x64'
});

tmr.registerMock('fs', {
    existsSync: function (pathToCheck: string): boolean {
        return true;
    },
    mkdirSync: function () { },
    writeFileSync: function () { },
    readdirSync: function (pathToCheck: string): string[] {
        if (pathToCheck === '/fake/agent/temp') {
            return ['node-v6.0.0-linux-x64'];
        }
        return [];
    },
    statSync: function () {
        return { isDirectory: () => true } as any;
    },
    copyFileSync: function () { },
    readFileSync: function (filePath: string, encoding: string) {
        return JSON.stringify([]);
    },
    constants: fs.constants
});

tmr.registerMock('azure-pipelines-tool-lib/tool', {
    cleanVersion: function (version: string) {
        return '6.17.1';
    },
    findLocalTool: function (toolName: string, versionSpec: string, arch?: string) {
        if (toolName !== 'node') {
            throw new Error('Searching for wrong tool');
        }
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
