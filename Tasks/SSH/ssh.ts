import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import sshHelper = require('./ssh2helpers');
import {RemoteCommandOptions} from './ssh2helpers'

async function run() {
    var sshClientConnection: any;
    var cleanUpScriptCmd: string;
    var remoteCmdOptions : RemoteCommandOptions = new RemoteCommandOptions();

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read SSH endpoint input
        var sshEndpoint = tl.getInput('sshEndpoint', true);
        var username:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
        var password:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional
        var privateKey:string = process.env['ENDPOINT_DATA_' + sshEndpoint + '_PRIVATEKEY']; //private key is optional, password can be used for connecting
        var hostname:string = tl.getEndpointDataParameter(sshEndpoint, 'host', false);
        var port:string = tl.getEndpointDataParameter(sshEndpoint, 'port', true); //port is optional, will use 22 as default port if not specified
        if(!port || port === '') {
            tl._writeLine(tl.loc('UseDefaultPort'));
            port = '22';
        }

        //setup the SSH connection configuration based on endpoint details
        var sshConfig;
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
        var runOptions : string = tl.getInput('runOptions', true);
        var commands : string[];
        var scriptFile : string;
        var args : string;

        if(runOptions === 'commands') {
            commands = tl.getDelimitedInput('commands', '\n', true);
        } else {
            scriptFile = tl.getPathInput('scriptPath', true, true);
            args = tl.getInput('args')
        }

        var failOnStdErr : boolean = tl.getBoolInput('failOnStdErr');
        remoteCmdOptions.failOnStdErr = failOnStdErr;

        //setup the SSH connection
        tl._writeLine(tl.loc('SettingUpSshConnection', sshConfig.username, sshConfig.host, sshConfig.port));
        try {
            sshClientConnection = await sshHelper.setupSshClientConnection(sshConfig);
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ConnectionFailed', err));
        }

        if(sshClientConnection) {
            //SSH connection successful
            if (runOptions === 'commands') {
                //run commands specified by the user
                for (var i:number = 0; i < commands.length; i++) {
                    tl.debug('Running command ' + commands[i] + ' on remote machine.');
                    tl._writeLine(commands[i]);
                    var returnCode:string = await sshHelper.runCommandOnRemoteMachine(
                        commands[i], sshClientConnection, remoteCmdOptions);
                    tl.debug('Command ' + commands[i] + ' completed with return code = ' + returnCode);
                }
            } else if (runOptions === 'script') {
                //setup script path on remote machine relative to user's $HOME directory
                var remoteScript = './' + path.basename(scriptFile);
                var remoteScriptPath = '"' + remoteScript + '"';
                tl.debug('remoteScriptPath = ' + remoteScriptPath);

                //copy script file to remote machine
                var scpConfig = sshConfig;
                scpConfig.path = remoteScript;
                tl.debug('Copying script to remote machine.');
                await sshHelper.copyScriptToRemoteMachine(scriptFile, scpConfig);

                //set execute permissions on the script
                tl.debug('Setting execute permisison on script copied to remote machine');
                tl._writeLine('chmod +x ' + remoteScriptPath);
                await sshHelper.runCommandOnRemoteMachine(
                    'chmod +x ' + remoteScriptPath, sshClientConnection, remoteCmdOptions);

                //run remote script file with args on the remote machine
                var runScriptCmd = remoteScriptPath;
                if (args) {
                    runScriptCmd = runScriptCmd.concat(' ' + args);
                }

                //setup command to clean up script file
                cleanUpScriptCmd = 'rm -f ' + remoteScriptPath;

                tl._writeLine(runScriptCmd);
                await sshHelper.runCommandOnRemoteMachine(
                    runScriptCmd, sshClientConnection, remoteCmdOptions);
            }
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //clean up script file if needed
        if(cleanUpScriptCmd) {
            try {
                tl.debug('Deleting the script file copied to the remote machine.');
                await sshHelper.runCommandOnRemoteMachine(
                    cleanUpScriptCmd, sshClientConnection, remoteCmdOptions);
            } catch(err) {
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

run();
