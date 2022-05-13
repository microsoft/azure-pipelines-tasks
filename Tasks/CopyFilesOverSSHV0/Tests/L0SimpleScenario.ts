import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfilesoverssh.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('sshEndpoint', 'fakeSshEndpoint');
tmr.setInput('sourceFolder', 'fakeSourceFolder');
tmr.setInput('contents', '**');
tmr.setInput('targetFolder', 'fakeTargetFolder');
tmr.setInput('readyTimeout', '20000');

//Create assertAgent and getVariable mocks, support not added in this version of task-lib
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function (variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp/path';
    }
    return null;
};
tlClone.assertAgent = function (variable: string) {
    return;
};
tlClone.getEndpointAuthorizationParameter = function (id, key) {
    return key;
};
tlClone.getEndpointDataParameter = function (id, key) {
    if (key === 'port') {
        return 22;
    }

    return key;
};
tlClone.getPathInput = function (key) {
    return `c:\\${key}`;
}

tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Mock task-lib
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    'checkPath' : {
        '/fakecwd' : true,
        'path/to/bash': true,
        'temp/path': true
    },
    'which': {
        'bash': 'path/to/bash'
    },
    'assertAgent': {
        '2.115.0': true
    },
    'exec': {
        'path/to/bash --noprofile --norc temp\\path\\fileName.sh': {
            "code": null
        },
        'path/to/bash --noprofile --norc temp/path/fileName.sh': {
            "code": null
        }
    },
    'getEndpointAuthorizationParameter': {

    },
    'stats':{
        'c:\\sourceFolder': {
            'isDirectory': true
        }
    },
    'find': {
        'c:\\sourceFolder': [
            'c:\\sourceFolder\\file1.txt',
            'c:\\sourceFolder\\file2.txt',
        ]
    }
};
tmr.setAnswers(a);

// Mock fs
const fs = require('fs');
const fsClone = Object.assign({}, fs);
fsClone.writeFileSync = function(filePath, contents, options) {
    console.log(`Writing ${contents} to ${filePath}`);
}
tmr.registerMock('fs', fsClone);

const ssh2Mock: any = {};
ssh2Mock.Client = function () {
    this.eventCallbacks = {};
    this.once = function (event: string, callback: () => void) {
        this.eventCallbacks[event] = callback;

        return this;
    };

    this.connect = function (sshConfig: any) {
        console.log('Successfully connected - ssh client');
        this.eventCallbacks['ready']();
    };
    this.on = function () { };
    this.end = function () { };
}
tmr.registerMock('ssh2', ssh2Mock);

const ssh2SftpClient = function () {
    this.connect = function (sshConfig: any) {
        console.log('Successfully connected - sftp client');
        return Promise.resolve();
    };
    this.exists = function () {
        return false;
    };
    this.mkdir = function (dirPath: string) {
        console.log(`Creating directory ${dirPath}`);
    };
    this.fastPut = function (sourceFile: string, dest: string) {
        console.log(`Fast put: sourceFile - ${sourceFile}, dest - ${dest}`);
    };
    this.on = function () { };
    this.end = function () { };
}
tmr.registerMock('ssh2-sftp-client', ssh2SftpClient);

tmr.run();