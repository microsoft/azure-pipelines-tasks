import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import os = require('os');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'nodetool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionSource', 'fromFile');
tmr.setInput('versionFilePath', 'src/.nvmrc');
tmr.setInput('checkLatest', 'false');
tmr.setInput('nodejsMirror', 'https://nodejs.org/dist');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.115.1": true
    }};
tmr.setAnswers(a);


//Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

//create fs mock
tmr.registerMock('fs', {
    readFileSync: function (path, options) {
        if (path != 'src/.nvmrc') {
            throw new Error(`reading wrong .nvmrc: '${[path]}'`);
        }

        return '11.3.0';
    }
});

//Create tool-lib mock
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    isExplicitVersion: function(versionSpec) {
        return false;
    },
    findLocalTool: function(toolName, versionSpec) {
        if (toolName != 'node') { 
            throw new Error('Searching for wrong tool');
        }
        return false;
    },
    evaluateVersions: function(versions, versionSpec) {
        if (versionSpec !== '11.3.0') {
            throw new Error(`Incorrect versionSpec: ${versionSpec}`);
        }
        return versionSpec;
    },
    cleanVersion: function(version) {
        return '11.3.0';
    },
    downloadTool(url) {
        if (url === `https://nodejs.org/dist/v11.3.0/node-v11.3.0-win-${os.arch()}.7z` ||
            url === `https://nodejs.org/dist/v11.3.0/node-v11.3.0-${os.platform()}-${os.arch()}.tar.gz`) {
            return 'location';
        }
        else {
            throw new Error('Incorrect URL');
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