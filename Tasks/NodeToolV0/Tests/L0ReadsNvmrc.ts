import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import os = require('os');
import path = require('path');
import semver = require('semver');

let taskPath = path.join(__dirname, '..', 'nodetool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionSpec', 'src/.nvmrc');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.115.1": true
    },
    "checkPath": {
        ".nvmrc": true,
    },
};
tmr.setAnswers(a);


//Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function (variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp';
    }
    return null;
};
tlClone.assertAgent = function (variable: string) {
    return;
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

tmr.registerMock('fs', {
    readFileSync: function (path, options) {
        if (path != 'src/.nvmrc') {
            throw new Error(`reading wrong .nvmrc: '${[path]}'`);
        }

        return '0.6.21';
    }
});

//Create tool-lib mock
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    isExplicitVersion: semver.valid,
    findLocalTool: function (toolName, versionSpec) {
        if (toolName != 'node') {
            throw new Error('Searching for wrong tool');
        }
        return false;
    },
    evaluateVersions: function (versions, versionSpec) {
        if (versionSpec !== 'v0.6.21') {
            throw new Error(`Incorrect versionSpec: ${versionSpec}`);
        }
        return versionSpec;
    },
    cleanVersion: semver.clean,
    downloadTool(url) {
        let err = new Error();
        err['httpStatusCode'] = '404';
        if (url === `https://nodejs.org/dist/v0.6.21/node-v0.6.21-win-${os.arch()}.7z` ||
            url === `https://nodejs.org/dist/v0.6.21/node-v0.6.21-${os.platform()}-${os.arch()}.tar.gz`) {
            throw err;
        }
        else if (url === `https://nodejs.org/dist/v0.6.21/win-${os.arch()}/node.exe`) {
            throw err;
        }
        else if (url === `https://nodejs.org/dist/v0.6.21/win-${os.arch()}/node.lib`) {
            throw err;
        }
        else if (url === `https://nodejs.org/dist/v0.6.21/node.exe`) {
            return 'exe_loc';
        }
        else if (url === `https://nodejs.org/dist/v0.6.21/node.lib`) {
            return 'exe_lib';
        }
        else {
            throw new Error(`Incorrect URL: ${url}`);
        }
    },
    extract7z(downloadPath, extPath, _7zPath) {
        return 'extPath';
    },
    extractTar(downloadPath, extPath, _7zPath) {
        return 'extPath';
    },
    cacheDir(dir, tool, version) {
        return 'path to tool';
    },
    prependPath(toolPath) {
        return;
    }
});

tmr.run();