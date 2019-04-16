import * as os from 'os';
import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as fs from 'fs';
import * as sshHelper from './ssh2helpers';
import { RemoteCommandOptions } from './ssh2helpers'

async function run() {
    let sshClientConnection: any;
    let cleanUpScriptCmd: string;
    const remoteCmdOptions: RemoteCommandOptions = new RemoteCommandOptions();

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read SSH endpoint input
        const sshEndpoint = tl.getInput('sshEndpoint', true);
        const username: string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
        const password: string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional
        const privateKey: string = process.env['ENDPOINT_DATA_' + sshEndpoint + '_PRIVATEKEY']; //private key is optional, password can be used for connecting
        const hostname: string = tl.getEndpointDataParameter(sshEndpoint, 'host', false);
        let port: string = tl.getEndpointDataParameter(sshEndpoint, 'port', true); //port is optional, will use 22 as default port if not specified
        if (!port || port === '') {
            tl._writeLine(tl.loc('UseDefaultPort'));
            port = '22';
        }

        //setup the SSH connection configuration based on endpoint details
        let sshConfig;
        if (privateKey && privateKey !== '') {
            tl.debug('Using private key for ssh connection.');
            sshConfig = {
                host: hostname,
                port: port,
                username: username,
                privateKey: privateKey,
                passphrase: password
            }
        } else {
            //use password
            tl.debug('Using username and password for ssh connection.');
            sshConfig = {
                host: hostname,
                port: port,
                username: username,
                password: password
            }
        }

        //read the run options
        const runOptions: string = tl.getInput('runOptions', true);
        let commands: string[];
        let scriptFile: string;
        let args: string;

        if (runOptions === 'commands') {
            // Split on '\n' and ';', flatten, and remove empty entries
            commands = tl.getDelimitedInput('commands', '\n', true)
                .map(s => s.split(';'))
                .reduce((a, b) => a.concat(b))
                .filter(s => s.length > 0);
        } else if (runOptions === 'inline') {
            let inlineScript: string = tl.getInput('inline', true);
            if (inlineScript && !inlineScript.startsWith('#!')) {
                const bashHeader: string = '#!/bin/bash';
                tl.debug('No script header detected.  Adding: ' + bashHeader);
                inlineScript = bashHeader + os.EOL + inlineScript;
            }
            const tempDir = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
            scriptFile = path.join(tempDir, 'sshscript_' + new Date().getTime()); // default name
            try {
                // Make sure the directory exists or else we will get ENOENT
                if (!fs.existsSync(tempDir))
                {
                    tl.mkdirP(tempDir);
                }
                fs.writeFileSync(scriptFile, inlineScript);
            } catch (err) {
                tl.error(tl.loc('FailedToWriteScript', err.message));
                tryDeleteFile(scriptFile);
                throw err;
            }
        } else {
            scriptFile = tl.getPathInput('scriptPath', true, true);
            args = tl.getInput('args')
        }

        const failOnStdErr: boolean = tl.getBoolInput('failOnStdErr');
        remoteCmdOptions.failOnStdErr = failOnStdErr;

        //setup the SSH connection
        tl._writeLine(tl.loc('SettingUpSshConnection', sshConfig.username, sshConfig.host, sshConfig.port));
        try {
            sshClientConnection = await sshHelper.setupSshClientConnection(sshConfig);
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ConnectionFailed', err));
        }

        if (sshClientConnection) {
            //SSH connection successful
            tl._writeLine(tl.loc('SshConnectionSuccessful'));
            if (runOptions === 'commands') {
                //run commands specified by the user
                for (const command of commands) {
                    tl.debug('Running command ' + command + ' on remote machine.');
                    tl._writeLine(command);
                    const returnCode: string = await sshHelper.runCommandOnRemoteMachine(
                        command, sshClientConnection, remoteCmdOptions);
                    tl.debug('Command ' + command + ' completed with return code = ' + returnCode);
                }
            } else { // both other runOptions: inline and script
                //setup script path on remote machine relative to user's $HOME directory
                const remoteScript = './' + path.basename(scriptFile);
                let remoteScriptPath = '"' + remoteScript + '"';
                const windowsEncodedRemoteScriptPath = remoteScriptPath;
                const isWin = os.platform() === 'win32';
                if (isWin) {
                    remoteScriptPath = '"' + remoteScript + "._unix" + '"';
                }
                tl.debug('remoteScriptPath = ' + remoteScriptPath);

                //copy script file to remote machine
                const scpConfig = sshConfig;
                scpConfig.path = remoteScript;
                tl.debug('Copying script to remote machine.');
                await sshHelper.copyScriptToRemoteMachine(scriptFile, scpConfig);

                //change the line encodings
                if (isWin) {
                    tl.debug('Fixing the line endings in case the file was created in Windows');
                    const removeLineEndingsCmd = 'tr -d \'\\015\' <' + windowsEncodedRemoteScriptPath + ' > ' + remoteScriptPath;
                    tl._writeLine(removeLineEndingsCmd);
                    await sshHelper.runCommandOnRemoteMachine(removeLineEndingsCmd, sshClientConnection, remoteCmdOptions);
                }

                //set execute permissions on the script
                tl.debug('Setting execute permisison on script copied to remote machine');
                tl._writeLine('chmod +x ' + remoteScriptPath);
                await sshHelper.runCommandOnRemoteMachine(
                    'chmod +x ' + remoteScriptPath, sshClientConnection, remoteCmdOptions);

                //run remote script file with args on the remote machine
                let runScriptCmd = remoteScriptPath;
                if (args) {
                    runScriptCmd = runScriptCmd.concat(' ' + args);
                }

                //setup command to clean up script file
                cleanUpScriptCmd = 'rm -f ' + remoteScriptPath;
                if (isWin) {
                    cleanUpScriptCmd = 'rm -f ' + remoteScriptPath + ' ' + windowsEncodedRemoteScriptPath;
                }

                tl._writeLine(runScriptCmd);
                await sshHelper.runCommandOnRemoteMachine(
                    runScriptCmd, sshClientConnection, remoteCmdOptions);
            }
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //clean up script file if needed
        if (cleanUpScriptCmd) {
            try {
                tl.debug('Deleting the script file copied to the remote machine.');
                await sshHelper.runCommandOnRemoteMachine(
                    cleanUpScriptCmd, sshClientConnection, remoteCmdOptions);
            } catch (err) {
                tl.warning(tl.loc('RemoteScriptFileCleanUpFailed', err));
            }
        }

        //close the client connection to halt build execution
        if (sshClientConnection) {
            tl.debug('Closing the SSH client connection.');
            sshClientConnection.end();
        }
    }
}

function tryDeleteFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            tl.error(err.message);
        }
    }
}

run();
