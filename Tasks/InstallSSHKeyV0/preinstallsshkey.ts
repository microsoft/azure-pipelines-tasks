import fs = require('fs');
import os = require('os');
import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import * as tl from 'azure-pipelines-task-lib/task';
import util = require('./installsshkey-util');

async function run() {

    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        let publicKey: string = tl.getInput('sshPublicKey', true).trim();
        let knownHostsEntry: string = tl.getInput('hostName', true).trim();
        let passphrase: string = tl.getInput('sshPassphrase', false);
        passphrase = !passphrase ? passphrase : passphrase.trim();

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

        await sshTool.installKey(publicKey, privateKeyLocation, passphrase);
        util.setKnownHosts(knownHostsEntry);
    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        // delete SSH key from temp location after installing
        if (secureFileId && secureFileHelpers) {
            secureFileHelpers.deleteSecureFile(secureFileId);
        }
    }
    tl.debug('End');
}

run();