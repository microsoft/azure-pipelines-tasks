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
    // let secureFileId: string;
    // let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    // try {
    //     tl.setResourcePath(path.join(__dirname, 'task.json'));

    //     // download decrypted contents
    //     secureFileId = tl.getInput('sshKeySecureFile', true);
    //     secureFileHelpers = new secureFilesCommon.SecureFileHelpers();
    //     let sshKeyPath: string = await secureFileHelpers.downloadSecureFile(secureFileId);

    //     if (tl.exist(sshKeyPath)) {
    //     }

    // } catch (err) {
    //     tl.setResult(tl.TaskResult.Failed, err);
    // } finally {
    //     // delete provisioning profile from temp location after installing
    //     if (secureFileId && secureFileHelpers) {
    //         secureFileHelpers.deleteSecureFile(secureFileId);
    //     }
    // }
    // tl.debug("Start");
    // var c = new sshAgentClient();
    // tl.debug("s = " + c);
    // var printKeys = async function(keys, err) {
    //     tl.debug("Keys = " + keys);
    //     tl.debug("Errs = " + err);
    // };
    // await c.list_keys(printKeys);
    // tl.debug("End");

    let privateKeyLocation: string = 'D:\\redist\\Keys.ssh\\lucas_id_rsa';
    let publicKeyLocation: string = 'D:\\redist\\Keys.ssh\\lucas_id_rsa.pub';
    let knownHostsEntry: string = 'daystar.visualstudio.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7Hr1oTWqNqOlzGJOfGJ4NakVyIzf1rXYd4d7wo6jBlkLvCA4odBlL0mDUyZ0/QUfTTqeu+tm22gOsv+VrVTMk6vwRU75gY/y9ut5Mb3bR5BV58dKXyq9A9UeB5Cakehn5Zgm6x1mKoVyf+FFn26iYqXJRgzIZZcZ5V6hrE0Qg39kZm4az48o0AUbf6Sp4SLdvnuMa2sVNwHBboS7EJkm57XQPVU3/QpyNLHbWDdzwtrlS+ez30S3AdYhLKEOxAG8weOnyrtLJAUen9mTkol8oII1edf7mWWbWVf0nBmly21+nZcmCTISQBtdcyPaEno7fFQMDD26/s0lfKob4Kw8H';
    // knownHostsEntry = 'daystar.visualstudio.com,157.55.80.96 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7Hr1oTWqNqOlzGJOfGJ4NakVyIzf1rXYd4d7wo6jBlkLvCA4odBlL0mDUyZ0/QUfTTqeu+tm22gOsv+VrVTMk6vwRU75gY/y9ut5Mb3bR5BV58dKXyq9A9UeB5Cakehn5Zgm6x1mKoVyf+FFn26iYqXJRgzIZZcZ5V6hrE0Qg39kZm4az48o0AUbf6Sp4SLdvnuMa2sVNwHBboS7EJkm57XQPVU3/QpyNLHbWDdzwtrlS+ez30S3AdYhLKEOxAG8weOnyrtLJAUen9mTkol8oII1edf7mWWbWVf0nBmly21+nZcmCTISQBtdcyPaEno7fFQMDD26/s0lfKob4Kw8H';

    try {
        let publicKey: string = fs.readFileSync(publicKeyLocation).toString().trim();

        // TDOO: convert this to secure file
        let privateKey: string = fs.readFileSync(privateKeyLocation).toString().trim();        

        let sshTool: util.SshToolRunner = new util.SshToolRunner();

        let pid: string = tl.getVariable(util.sshAgentPidEnvVariableKey);
        let sock: string = tl.getVariable(util.sshAgentSockEnvVariableKey);
        tl.debug('PID=' + pid + ' SOCK=' + sock);
        if (!pid || !sock) {
            sshTool.runAgent();
        }

        sshTool.installKey(publicKey, privateKeyLocation);
        util.setKnownHosts(knownHostsEntry);
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, "" + err);
    }
    tl.debug('End');
}

run();