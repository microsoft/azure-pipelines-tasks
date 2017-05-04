import fs = require('fs');
import os = require('os');
import path = require('path');
import secureFilesCommon = require('securefiles-common/securefiles-common');
import tl = require('vsts-task-lib/task');

import trm = require('vsts-task-lib/toolrunner');

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

    // Used in Post phase
    const postKillAgentSetting: string = 'INSTALL_SSH_KEY_KILL_SSH_AGENT_PID';
    const postDeleteKeySetting: string = 'INSTALL_SSH_KEY_DELETE_KEY';
    const postKnownHostsContentsSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_CONTENTS';
    const postKnownHostsLocationSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_LOCATION';

    const sshAgentPidEnvVariableKey: string = 'SSH_AGENT_PID';
    const sshAgentSockEnvVariableKey: string = 'SSH_AUTH_SOCK';

    let external: string = 'C:\\Program Files\\Git\\usr\\bin\\';
    let privateKeyLocation: string = 'D:\\redist\\Keys.ssh\\lucas_id_rsa';
    let publicKeyLocation: string = 'D:\\redist\\Keys.ssh\\lucas_id_rsa.pub';
    let knownHostsEntry: string = 'daystar.visualstudio.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7Hr1oTWqNqOlzGJOfGJ4NakVyIzf1rXYd4d7wo6jBlkLvCA4odBlL0mDUyZ0/QUfTTqeu+tm22gOsv+VrVTMk6vwRU75gY/y9ut5Mb3bR5BV58dKXyq9A9UeB5Cakehn5Zgm6x1mKoVyf+FFn26iYqXJRgzIZZcZ5V6hrE0Qg39kZm4az48o0AUbf6Sp4SLdvnuMa2sVNwHBboS7EJkm57XQPVU3/QpyNLHbWDdzwtrlS+ez30S3AdYhLKEOxAG8weOnyrtLJAUen9mTkol8oII1edf7mWWbWVf0nBmly21+nZcmCTISQBtdcyPaEno7fFQMDD26/s0lfKob4Kw8H';
    // knownHostsEntry = 'daystar.visualstudio.com,157.55.80.96 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7Hr1oTWqNqOlzGJOfGJ4NakVyIzf1rXYd4d7wo6jBlkLvCA4odBlL0mDUyZ0/QUfTTqeu+tm22gOsv+VrVTMk6vwRU75gY/y9ut5Mb3bR5BV58dKXyq9A9UeB5Cakehn5Zgm6x1mKoVyf+FFn26iYqXJRgzIZZcZ5V6hrE0Qg39kZm4az48o0AUbf6Sp4SLdvnuMa2sVNwHBboS7EJkm57XQPVU3/QpyNLHbWDdzwtrlS+ez30S3AdYhLKEOxAG8weOnyrtLJAUen9mTkol8oII1edf7mWWbWVf0nBmly21+nZcmCTISQBtdcyPaEno7fFQMDD26/s0lfKob4Kw8H';

    try {
        // 1. Make sure SSH-Agent is started
        // 2. Get the list of keys (SSH-Add -l)
        // 3. Check for key to add
        // 4. Add key (SSH-Add publicKey / privateKey)
        // 5. Add entry to known_hosts
        //      -How to create a known_hosts entry:
        //          $ ssh-keyscan -t rsa server_ip
        //          # server_ip SSH-2.0-OpenSSH_4.3
        //          server_ip ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAwH5EXZG...
        //      -Flag for deletion if necessary

        let publicKey: string = fs.readFileSync(publicKeyLocation).toString().trim();

        // TDOO: convert this to secure file
        let privateKey: string = fs.readFileSync(privateKeyLocation).toString().trim();        

        let pid: string = tl.getVariable(sshAgentPidEnvVariableKey);
        let sock: string = tl.getVariable(sshAgentSockEnvVariableKey);
        tl.debug('PID=' + pid + ' SOCK=' + sock);
        if (!pid || !sock) {
            // Expected output sample:
            // SSH_AUTH_SOCK=/tmp/ssh-XVblDhTvcbC3/agent.24196; export SSH_AUTH_SOCK;
            // SSH_AGENT_PID=4644; export SSH_AGENT_PID; echo Agent pid 4644;
            let agentResults: trm.IExecSyncResult = tl.execSync(path.join(external, 'ssh-agent.exe'), null);
            debugOutput(agentResults);

            let elements: string[] = agentResults.stdout.split(';');
            for (let i:number = 0; i < elements.length; ++i) {
                let keyValue : string[] = elements[i].split('=');
                if (keyValue && keyValue.length >= 2) {
                    let key: string = keyValue[0].trim();
                    let value: string =  keyValue[1].trim();
                    tl.debug('Key=' + key + ' value=' + value);
                    if (sshAgentPidEnvVariableKey === key) {
                        tl.setVariable(key, value);
                        tl.setTaskVariable(postKillAgentSetting, value);    
                    }
                    else if (sshAgentSockEnvVariableKey === key) {
                        tl.setVariable(key, value);
                    }
                } else {
                    tl.debug('Skipping ' + elements[i]);
                }
            }
        }

        // 2. Get the list of keys (SSH-Add -l)
        tl.debug('Get a list of the SSH keys in the agent');
        let results: trm.IExecSyncResult = tl.execSync(path.join(external, 'ssh-add.exe'), '-L');
        debugOutput(results);

        let publicKeyComponents:string[] = publicKey.split(' ');
        if (publicKeyComponents.length <= 1) {
            throw tl.loc('SSHPublicKeyMalformed');
        }

        let publicKeyHash: string = publicKeyComponents[1];
        tl.debug('Checking for public SSH key: ' + publicKeyHash);
        if (results.stdout.indexOf(publicKeyHash) !== -1) {
            throw tl.loc('SSHKeyAlreadyInstalled');
        }

        // 3. Add key
        tl.debug('Adding the SSH key to the agent');
        results = tl.execSync(path.join(external, 'ssh-add.exe'), privateKeyLocation);
        debugOutput(results);
        if (results.error) {
            throw tl.loc('SSHKeyInstallFailed');
        }
        tl.setTaskVariable(postDeleteKeySetting, privateKeyLocation);

        results = tl.execSync(path.join(external, 'ssh-add.exe'), null);
        debugOutput(results);

        // 5. Add entry to known_hosts
        //      -How to create a known_hosts entry:
        //          $ ssh-keyscan -t rsa server_ip
        //          # server_ip SSH-2.0-OpenSSH_4.3
        //          server_ip ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAwH5EXZG...
        //      -Flag for deletion if necessary
        let knownHostsFolder: string = path.join(os.homedir(), '.ssh');
        if (!fs.existsSync(knownHostsFolder)) {
            fs.mkdirSync(knownHostsFolder);
        }
        let knownHostsFile: string = path.join(knownHostsFolder, 'known_hosts');

        tl.debug('Read known_hosts');
        tl.setTaskVariable(postKnownHostsContentsSetting, fs.readFileSync(knownHostsFile).toString());
        tl.setTaskVariable(postKnownHostsLocationSetting, knownHostsFile);

        tl.debug('Inserting entry into known_hosts');
        fs.writeFileSync(knownHostsFile, knownHostsEntry + os.EOL);
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, "" + err);
    }
    tl.debug('End');
}

run();