import path = require('path');
import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const postTaskPath = path.join(__dirname, '..', 'postinstallsshkey.js');
const sshPublicKey: string = 'ssh-rsa KEYINFORMATIONHERE sample@example.com'
const taskRunner: TaskMockRunner = new TaskMockRunner(postTaskPath);

taskRunner.setInput('sshKeySecureFile', 'mySecureFileId');
taskRunner.setInput('sshPublicKey', sshPublicKey);
taskRunner.setInput('hostName', 'host name entry');

process.env['AGENT_VERSION'] = '2.117.0';
process.env['AGENT_HOMEDIRECTORY'] = '';
process.env['SSH_AGENT_PID'] = '123456';
process.env['VSTS_TASKVARIABLE_INSTALL_SSH_KEY_DELETE_KEY'] = "keyToRemove";

const secureFileHelperMock = require('./secure-files-mock.js');
taskRunner.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

class MockStats {
    mode = 600;
};
const fsAnswers = {
    writeFileSync: function (filePath, contents) {
    },
    existsSync: function (filePath, contents) {
        return true;
    },
    readFileSync: function (filePath) {
        return 'contents';
    },
    statSync: function (filePath) {
        let s : MockStats = new MockStats();
        return s;
    },
    chmodSync: function (filePath, string) {
    }
};
taskRunner.registerMock('fs', fsAnswers);

// provide answers for task mock
let answers: TaskLibAnswers = {
    "which": {
        "ssh-agent": "/usr/bin/ssh-agent",
        "ssh-add": "/usr/bin/ssh-add"
    },
    "checkPath": {
        "/usr/bin/ssh-agent": true,
        "/usr/bin/ssh-add": true
    },
    "exec": {
        "/usr/bin/ssh-add -d keyToRemove": {
            "code": 0,
            "stdout": "removed from running agent"
        },
    }
};

taskRunner.setAnswers(answers);

taskRunner.run();
