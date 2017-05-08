import fs = require('fs');
import os = require('os');
import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');


export const postKillAgentSetting: string = 'INSTALL_SSH_KEY_KILL_SSH_AGENT_PID';
export const postDeleteKeySetting: string = 'INSTALL_SSH_KEY_DELETE_KEY';
export const postKnownHostsContentsSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_CONTENTS';
export const postKnownHostsLocationSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_LOCATION';

export const sshAgentPidEnvVariableKey: string = 'SSH_AGENT_PID';
export const sshAgentSockEnvVariableKey: string = 'SSH_AUTH_SOCK';


export class SshToolRunner {
    private baseDir = tl.getVariable('Agent.HomeDirectory');
    private sshGitExternalsDir = path.join('externals', path.join('Git', path.join('usr', path.join('bin'))));

    constructor() {
    }

    private getExecutable(executable: string):string {
        let isWindows: RegExpMatchArray = os.type().match(/^Win/);
        if (isWindows && this.baseDir) {
            executable = path.join(this.baseDir, path.join(this.sshGitExternalsDir, executable));
            executable += '.exe';
        }
        return executable;
    }

    public runAgent() {
        // Expected output sample:
        // SSH_AUTH_SOCK=/tmp/ssh-XVblDhTvcbC3/agent.24196; export SSH_AUTH_SOCK;
        // SSH_AGENT_PID=4644; export SSH_AGENT_PID; echo Agent pid 4644;
        let agentResults: trm.IExecSyncResult = tl.execSync(this.getExecutable('ssh-agent'), null);

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

    public installKey(publicKey: string, privateKeyLocation: string) {
        tl.debug('Get a list of the SSH keys in the agent');
        let results: trm.IExecSyncResult = tl.execSync(this.getExecutable('ssh-add'), '-L');

        let publicKeyComponents:string[] = publicKey.split(' ');
        if (publicKeyComponents.length <= 1) {
            throw tl.loc('SSHPublicKeyMalformed');
        }

        let publicKeyHash: string = publicKeyComponents[1];
        tl.debug('Checking for public SSH key: ' + publicKeyHash);
        if (results.stdout.indexOf(publicKeyHash) !== -1) {
            throw tl.loc('SSHKeyAlreadyInstalled');
        }

        tl.debug('Adding the SSH key to the agent ' + privateKeyLocation);
        results = tl.execSync(this.getExecutable('ssh-add'), privateKeyLocation);
        if (results.error) {
            throw tl.loc('SSHKeyInstallFailed');
        }
        tl.setTaskVariable(postDeleteKeySetting, privateKeyLocation);

        results = tl.execSync(this.getExecutable('ssh-add'), null);
    }

    public deleteKey(key: string) {
        let deleteKey: string = tl.getTaskVariable(postDeleteKeySetting);
        if (deleteKey) {
            tl.debug('Deleting Key: ' + deleteKey);
            tl.execSync(path.join(external, 'ssh-add.exe'), ['-d', deleteKey]);
        }
    }
}

export function setKnownHosts(knownHostsEntry: string) {
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

export function tryRestoreKnownHosts() {
    let knownHostsContents: string = tl.getTaskVariable(postKnownHostsContentsSetting);
    let knownHostsLocation: string = tl.getTaskVariable(postKnownHostsLocationSetting);

    tl.debug('Restoring known_hosts');
    if (knownHostsContents && knownHostsLocation) {
        fs.writeFileSync(knownHostsLocation, knownHostsContents);
    } else if (knownHostsLocation || knownHostsContents) {
        tl.warning('Inconsistency with known_hosts cannot reset (location=' + knownHostsLocation + ' content=' + knownHostsContents + ')');
    }
}