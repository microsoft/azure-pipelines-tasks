import fs = require('fs');
import os = require('os');
import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');

import trm = require('vsts-task-lib/toolrunner');

import util = require('./installsshkey-util');

// var sshAgent = require('ssh-agent-js');
var sshAgentClient = require('ssh-agent-js/client');

function debugOutput(results: trm.IExecSyncResult) {
    tl.debug('stdout=' + results.stdout);
    tl.debug('stderr=' + results.stderr);
    tl.debug('code  =' + results.code);
    tl.debug('error =' + results.error);
}

async function run() {

    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        let publicKey: string = tl.getInput('sshPublicKey', true).trim();
        let knownHostsEntry: string = tl.getInput('hostName', true).trim();

        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // download ssh key contents
        secureFileId = tl.getInput('sshKeySecureFile', true);
        secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
        let privateKeyLocation: string = await secureFileHelpers.downloadSecureFile(secureFileId);

        let sshTool: util.SshToolRunner = new util.SshToolRunner();

        let pid: string = tl.getVariable(util.sshAgentPidEnvVariableKey);
        let sock: string = tl.getVariable(util.sshAgentSockEnvVariableKey);
        tl.debug('PID=' + pid + ' SOCK=' + sock);
        if (!pid || !sock) {
            sshTool.runAgent();
        }

        sshTool.installKey(publicKey, privateKeyLocation);
        util.setKnownHosts(knownHostsEntry);
    } catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, "" + err);
    } finally {
        // delete provisioning profile from temp location after installing
        if (secureFileId && secureFileHelpers) {
            secureFileHelpers.deleteSecureFile(secureFileId);
        }
    }
    tl.debug('End');
}

run();