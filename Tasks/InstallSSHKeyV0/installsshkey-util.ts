import fs = require('fs');
import os = require('os');
import Q = require('q');
import path = require('path');
import process = require('process');
import child = require('child_process');

import * as tl from 'azure-pipelines-task-lib/task';
import * as trm from 'azure-pipelines-task-lib/toolrunner';

export const postKillAgentSetting: string = 'INSTALL_SSH_KEY_KILL_SSH_AGENT_PID';
export const postDeleteKeySetting: string = 'INSTALL_SSH_KEY_DELETE_KEY';
export const postKnownHostsContentsSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_CONTENTS';
export const postKnownHostsLocationSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_LOCATION';
export const postKnownHostsDeleteFileSetting: string = 'INSTALL_SSH_KEY_KNOWN_HOSTS_FILE_DELETE';

export const sshAgentPidEnvVariableKey: string = 'SSH_AGENT_PID';
export const sshAgentSockEnvVariableKey: string = 'SSH_AUTH_SOCK';

function execSshAddPassphraseSync(tool, args, passphrase):Q.Promise<boolean> {
    tl.debug('execSshAddPassphraseSync');

    var defer = Q.defer<boolean>();
    let success = true;

    let cp = child.spawn(tool, args, {
        detached: true // required to work on macOS
    });

    var processLineBuffer = (data: Buffer, strBuffer: string, onLine:(line: string) => void): void => {
        try {
            var s = strBuffer + data.toString();
            var n = s.indexOf(os.EOL);

            while(n > -1) {
                var line = s.substring(0, n);
                onLine(line);

                // the rest of the string ...
                s = s.substring(n + os.EOL.length);
                n = s.indexOf(os.EOL);
            }

            strBuffer = s;                
        }
        catch (err) {
            tl.debug('error processing line');
        }
    }

    var stdbuffer: string = '';
    cp.stdout.on('data', (data: Buffer) => {
        process.stdout.write(data);
        processLineBuffer(data, stdbuffer, (line: string) => {
            tl.debug('stdline:' + line);    
        });
    });

    var errbuffer: string = '';
    cp.stderr.on('data', (data: Buffer) => {
        // ssh-add puts output on stderr
        process.stderr.write(data);
        processLineBuffer(data, errbuffer, (line: string) => {
            tl.debug('errline:' + line);    
        });            
    });

    cp.on('error', (err) => {
        defer.reject(new Error(tool + ' failed. ' + err.message));
    });

    cp.on('close', (code, signal) => {
        tl.debug('rc:' + code);

        if (stdbuffer.length > 0) {
            tl.debug('stdline:' + stdbuffer);
        }
        
        if (errbuffer.length > 0) {
            tl.debug('errline:' + errbuffer);
        }

        // Always ignore the return code
        tl.debug('success:' + success);
        if (!success) {
            defer.reject(new Error(tool + ' failed with return code: ' + code));
        }
        else {
            defer.resolve(success);
        }
    });
    tl.debug('writing passphrase');
    cp.stdin.write(passphrase);
    cp.stdin.end();
    tl.debug('passphrase complete');

    return defer.promise;
}

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

    public async installKey(publicKey: string, privateKeyLocation: string, passphrase: string) {
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
        let oldMode: number = fs.statSync(privateKeyLocation).mode;
        fs.chmodSync(privateKeyLocation, '600'); // requires user only permissions when adding to agent

        let installedSSH:boolean = false;
        if (passphrase) {        
            installedSSH = await execSshAddPassphraseSync(this.getExecutable('ssh-add'), [privateKeyLocation], passphrase);
        } else {
            results = tl.execSync(this.getExecutable('ssh-add'), privateKeyLocation);
            installedSSH = !results.error;
        }
        if (!installedSSH) {
            throw tl.loc('SSHKeyInstallFailed');
        }
        fs.chmodSync(privateKeyLocation, oldMode);
        tl.setTaskVariable(postDeleteKeySetting, privateKeyLocation);

        results = tl.execSync(this.getExecutable('ssh-add'), null);
    }

    public deleteKey(key: string) {
        let deleteKey: string = tl.getTaskVariable(postDeleteKeySetting);
        if (deleteKey) {
            tl.debug('Deleting Key: ' + deleteKey);
            tl.execSync(this.getExecutable('ssh-add'), ['-d', deleteKey]);
        }
    }
}

export function setKnownHosts(knownHostsEntry: string) {
    let knownHostsFolder: string = path.join(os.homedir(), '.ssh');
    let knownHostsFile: string = path.join(knownHostsFolder, 'known_hosts');
    let knownHostsContent: string = '';
    let knownHostsDeleteFileOnClose: string = 'true';
    if (!fs.existsSync(knownHostsFolder)) {
        fs.mkdirSync(knownHostsFolder);
    } else if (fs.existsSync(knownHostsFile)) {
        tl.debug('Read known_hosts');
        knownHostsDeleteFileOnClose = '';
        knownHostsContent = fs.readFileSync(knownHostsFile).toString();
    }

    tl.setTaskVariable(postKnownHostsContentsSetting, knownHostsContent);
    tl.setTaskVariable(postKnownHostsLocationSetting, knownHostsFile);
    tl.setTaskVariable(postKnownHostsDeleteFileSetting, knownHostsDeleteFileOnClose);

    tl.debug('Inserting entry into known_hosts');
    fs.writeFileSync(knownHostsFile, knownHostsEntry + os.EOL);
}

export function tryRestoreKnownHosts() {
    let knownHostsContents: string = tl.getTaskVariable(postKnownHostsContentsSetting);
    let knownHostsLocation: string = tl.getTaskVariable(postKnownHostsLocationSetting);
    let knownHostsDeleteFileOnExit: string = tl.getTaskVariable(postKnownHostsDeleteFileSetting);
    
    tl.debug('Restoring known_hosts');
    if (knownHostsDeleteFileOnExit && knownHostsLocation) {
        fs.unlinkSync(knownHostsLocation);
    } else if (knownHostsContents && knownHostsLocation) {
        fs.writeFileSync(knownHostsLocation, knownHostsContents);
    } else if (knownHostsLocation || knownHostsContents) {
        tl.warning(tl.loc('CannotResetKnownHosts'));
        tl.debug('(location=' + knownHostsLocation + ' content=' + knownHostsContents + ')');
    }
}