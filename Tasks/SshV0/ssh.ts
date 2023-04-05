import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as sshHelper from './ssh2helpers';
import { v4 as generateRandomUUID } from 'uuid';
import { ConnectConfig } from 'ssh2';

/**
 * By default configuration, SSH runs on port 22.
 * @constant {number}
 * @default
*/
const DEFAULT_SSH_PORT: number = 22;

async function run() {
    let sshClientConnection: any;
    let cleanUpScriptCmd: string;
    const remoteCmdOptions: sshHelper.RemoteCommandOptions = new sshHelper.RemoteCommandOptions();

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read SSH endpoint input
        const sshEndpoint = tl.getInput('sshEndpoint', true);
        const tryKeyboard: boolean = tl.getBoolInput('interactiveKeyboardAuthentication', false);
        const username: string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
        const password: string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional
        const privateKey: string = process.env['ENDPOINT_DATA_' + sshEndpoint + '_PRIVATEKEY']; //private key is optional, password can be used for connecting
        const hostname: string = tl.getEndpointDataParameter(sshEndpoint, 'host', false);
        const port: number = getServerPort(sshEndpoint); //port is optional, will use 22 as default port if not specified
        const interactiveSession: boolean = tl.getBoolInput('interactiveSession', false);
        const readyTimeout = getReadyTimeoutVariable();

        //setup the SSH connection configuration based on endpoint details
        const sshConfig: ConnectConfig = {
            host: hostname,
            port: port,
            username: username,
            readyTimeout: readyTimeout,
            tryKeyboard: tryKeyboard,
        };

        if (privateKey) {
            tl.debug('Using private key for ssh connection.');
            sshConfig.privateKey = privateKey;
            sshConfig.passphrase = password;
        } else {
            //use password
            tl.debug('Using username and password for ssh connection.');
            sshConfig.password = password;
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
            const interpreterCommand: string = tl.getInput('interpreterCommand');
            if (inlineScript && !inlineScript.startsWith('#!') && interpreterCommand) {
                tl.debug('No script header detected.  Adding: #!' + interpreterCommand);
                inlineScript = `#!${interpreterCommand}${os.EOL}${inlineScript}`;
            }
            const tempDir: string = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
            const scriptName: string = `sshscript_${generateRandomUUID()}`; // default name
            scriptFile = path.join(tempDir, scriptName);
            try {
                // Make sure the directory exists or else we will get ENOENT
                if (!fs.existsSync(tempDir)) {
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
            args = tl.getInput('args');
        }

        const failOnStdErr: boolean = tl.getBoolInput('failOnStdErr');
        remoteCmdOptions.failOnStdErr = failOnStdErr;

        //setup the SSH connection
        console.log(tl.loc('SettingUpSshConnection', sshConfig.username, sshConfig.host, sshConfig.port));
        try {
            sshClientConnection = await sshHelper.setupSshClientConnection(sshConfig);
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ConnectionFailed', err));
        }

        if (sshClientConnection) {
            //SSH connection successful
            console.log(tl.loc('SshConnectionSuccessful'));
            if (runOptions === 'commands') {
                //run commands specified by the user
                for (const command of commands) {
                    tl.debug(`Running command ${command} on remote machine.`);
                    console.log(command);
                    const returnCode: string = await sshHelper.runCommandOnRemoteMachine(
                        command, sshClientConnection, remoteCmdOptions, password, interactiveSession);
                    tl.debug(`Command ${command} completed with return code = ${returnCode}`);
                }
            } else {
                // both other runOptions: inline and script
                // setup script path on remote machine relative to user's $HOME directory
                let remoteScriptPath: string = `./${path.basename(scriptFile)}`;
                const isWin: boolean = (os.platform() === 'win32');
                tl.debug(`remoteScriptPath = ${remoteScriptPath}`);

                //setup the scp configuration based on endpoint details
                const scpConfig: sshHelper.ScpConfig = {
                    host: hostname,
                    port: port,
                    username: username,
                };

                if (privateKey) {
                    scpConfig.privateKey = privateKey;
                    scpConfig.passphrase = password;
                } else {
                    scpConfig.password = password;
                }

                 //copy script file to remote machine
                tl.debug('Copying script to remote machine.');
                await sshHelper.copyScriptToRemoteMachine(scriptFile, remoteScriptPath, scpConfig);

                //change the line encodings
                let originalScriptPath: string = ''; 
                if (isWin) {
                    tl.debug('Fixing the line endings in case the file was created in Windows');
                    originalScriptPath = remoteScriptPath;
                    remoteScriptPath = await sshHelper.clearFileFromWindowsCRLF(sshClientConnection, remoteCmdOptions, originalScriptPath);
                }

                //set execute permissions on the script
                tl.debug('Setting execute permission on script copied to remote machine');
                console.log(`chmod +x ${remoteScriptPath}`);
                await sshHelper.runCommandOnRemoteMachine(`chmod +x ${remoteScriptPath}`, sshClientConnection, remoteCmdOptions);

                //run remote script file with args on the remote machine
                let runScriptCmd = remoteScriptPath;
                if (args) {
                    runScriptCmd = runScriptCmd.concat(' ' + args);
                }

                //setup command to clean up script file
                cleanUpScriptCmd = `rm -f ${remoteScriptPath}`;
                if (isWin) {
                    cleanUpScriptCmd = `rm -f ${remoteScriptPath} ${originalScriptPath}`;
                }

                console.log(runScriptCmd);
                await sshHelper.runCommandOnRemoteMachine(
                    runScriptCmd, sshClientConnection, remoteCmdOptions, password, interactiveSession);
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

function getReadyTimeoutVariable(): number {
    const readyTimeoutString: string = tl.getInput('readyTimeout', true);
    const readyTimeout: number = parseInt(readyTimeoutString, 10);

    return readyTimeout;
}

/**
 * Read port number from SSH endpoint input
 * @param {string} sshEndpoint - name of the service endpoint
 * @returns {number} Port number of remote ssh server.
 *
 * If port is not specified in the endpoint configuration, the default port value number will be returned.
 */
function getServerPort(sshEndpoint: string): number {
    let port: number = DEFAULT_SSH_PORT;
    const portString: string = tl.getEndpointDataParameter(sshEndpoint, 'port', true);

    if (portString) {
        port = parseInt(portString, 10);
    } else {
        console.log(tl.loc('UseDefaultPort'));
    }

    return port;
}
