import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import taskLib = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import os = require('os');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'usenode.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.115.1": true
    }};
tmr.setAnswers(a);


//Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getInput = function (inputName: string, required?: boolean) {
    inputName = inputName.toLowerCase();
    if (inputName === 'version') {
        return '11.3.0';
    }
    if (inputName === 'checkLatest') {
        return 'false';
    }
    return tl.getInput(inputName, required);
}
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tlClone.setSecret = function(password){
    console.log('Setting secret', password);
};
tlClone.setVariable = function(key, val) {
    console.log('Setting', key, 'to', val);
};
if (process.env["__proxy__"]) {
    tlClone.getHttpProxyConfiguration = function(requestUrl?: string): taskLib.ProxyConfiguration | null {
        return { proxyUrl: 'http://url.com', proxyUsername: 'username', proxyPassword: 'password', proxyBypassHosts: null};
    }
}
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

//Create tool-lib mock
tmr.registerMock('vsts-task-tool-lib/tool', {
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
        let version: string;
        for (let i = versions.length - 1; i >= 0; i--) {
            let potential: string = versions[i];
            let satisfied: boolean = potential === 'v11.3.0';
            if (satisfied) {
                version = potential;
                break;
            }
        }
        return version;
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

const fsClone = fs;
fsClone.existsSync = function(pathToFile: string): boolean {
    if (pathToFile !== path.resolve(process.cwd(), '.npmrc')) {
        throw 'Incorrect path ' + pathToFile
    }
    return false;
};
fsClone.writeFileSync = function(path: string, data: any, options: fs.WriteFileOptions) {
    console.log('Writing file to path', path);
    console.log(data);
};
tmr.registerMock('fs', fsClone);

tmr.run();