import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

const postTaskPath = path.join(__dirname, '..', 'postinstallsshkey.js');
const sshPublicKey: string = 'ssh-rsa KEYINFORMATIONHERE sample@example.com'
const postTr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(postTaskPath);

postTr.setInput('sshKeySecureFile', 'mySecureFileId');
postTr.setInput('sshPublicKey', sshPublicKey);
postTr.setInput('hostName', 'host name entry');

process.env['AGENT_VERSION'] = '2.117.0';
process.env['AGENT_HOMEDIRECTORY'] = '';
process.env['SSH_AGENT_PID'] = '123456';
process.env['VSTS_TASKVARIABLE_INSTALL_SSH_KEY_DELETE_KEY'] = "keyToRemove";

const secureFileHelperMock = require('./secure-files-mock.js');
postTr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

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
postTr.registerMock('fs', fsAnswers);

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
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

postTr.setAnswers(a);

postTr.run();
