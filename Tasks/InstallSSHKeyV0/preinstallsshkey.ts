import fs = require('fs');
import os = require('os');
import path = require('path');
import secureFilesCommon = require('azure-pipelines-tasks-securefiles-common/securefiles-common');
import * as tl from 'azure-pipelines-task-lib/task';
import util = require('./installsshkey-util');
import { ConfigFileEntry } from "./config-entry"

async function run() {

    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;
    const addConfigEntry: boolean = tl.getBoolInput('addEntryToConfig', false);

    try {
        let publicKey: string = tl.getInput('sshPublicKey', false);
        let knownHostsEntry: string = tl.getInput('hostName', true).trim();
        let passphrase: string = tl.getInput('sshPassphrase', false);
        passphrase = !passphrase ? passphrase : passphrase.trim();
        publicKey = !publicKey ? publicKey : publicKey.trim();

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

        if (addConfigEntry) {
            const alias: string = tl.getInput('configHostAlias', true);
            const user: string = tl.getInput('configUser', false);
            const hostname: string = tl.getInput('configHostname', true);
            const port: string = tl.getInput('configPort', false);
            const configEntry: ConfigFileEntry = new ConfigFileEntry(alias, hostname, user, privateKeyLocation, port);
            util.addConfigEntry(configEntry);
            tl.setTaskVariable(util.preservedKeyFileIDVariableKey, secureFileId);
        }
    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        // delete SSH key from temp location after installing
        if (!addConfigEntry && secureFileId && secureFileHelpers) {
            secureFileHelpers.deleteSecureFile(secureFileId);
        }
    }
    tl.debug('End');
}

run();