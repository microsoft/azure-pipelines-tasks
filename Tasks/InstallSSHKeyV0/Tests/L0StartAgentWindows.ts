import path = require('path');
import assert = require('assert');
import { MocksRegistrator } from './mocks-registrator';
import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'preinstallsshkey.js');
const taskRunner: TaskMockRunner = new TaskMockRunner(taskPath);
const agentHomeDirectory = 'C:\\agent';
const sshAgent = path.join(agentHomeDirectory, 'externals', 'Git', 'usr', 'bin', 'ssh-agent.exe');
const sshAdd = path.join(agentHomeDirectory, 'externals', 'Git', 'usr', 'bin', 'ssh-add.exe');

taskRunner.setInput('sshKeySecureFile', 'mySecureFileId');
taskRunner.setInput('sshPublicKey', 'ssh-rsa KEYINFORMATIONHERE sample@example.com');
taskRunner.setInput('hostName', 'host name entry');

process.env['AGENT_VERSION'] = '5.277.0';
process.env['AGENT_HOMEDIRECTORY'] = agentHomeDirectory;
process.env['AGENT_TEMPDIRECTORY'] = 'C:\\agent\\_work\\_temp';

MocksRegistrator.register(taskRunner, 'Windows_NT');

const answers: TaskLibAnswers = {
    "which": {
        "security": "/usr/bin/security",
        "ssh-agent": sshAgent,
        "ssh-add": sshAdd,
        "rm": "/bin/rm",
        "cp": "/bin/cp",
        "icacls": "/bin/icacls",
        "whoami": "/bin/whoami"
    },
    "checkPath": {
        [sshAgent]: true,
        [sshAdd]: true,
        "/bin/icacls": true,
        "/bin/whoami": true
    },
    "exist": {
        "/build/temp/mySecureFileId.filename": true
    },
    "exec": {
        [sshAgent]: {
            "code": 0,
            "stdout": "SSH_AUTH_SOCK=/tmp/ssh-XVblDhTvcbC3/agent.24196; export SSH_AUTH_SOCK; SSH_AGENT_PID=4644; export SSH_AGENT_PID; echo Agent pid 4644;"
        },
        [sshAdd]: {
            "code": 0,
            "stdout": ""
        },
        [`${sshAdd} -L`]: {
            "code": 0,
            "stdout": "No keys"
        },
        [`${sshAdd} /build/temp/mySecureFileId.filename`]: {
            "code": 0,
            "stdout": ""
        },
        "/bin/icacls /build/temp/mySecureFileId.filename /inheritance:r": {
            "code": 0,
            "stdout": ""
        },
        "/bin/icacls /build/temp/mySecureFileId.filename /grant:r testUser:(F)": {
            "code": 0,
            "stdout": ""
        },
        "/bin/whoami": {
            "code": 0,
            "stdout": "testUser"
        }
    }
};
taskRunner.setAnswers(answers);

taskRunner.run();
assert.equal(process.env['HOME'], process.env['AGENT_TEMPDIRECTORY']);
