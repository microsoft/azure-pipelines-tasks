/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import Q = require('q');
var Ssh2Client = require('ssh2').Client;
var Scp2Client = require('scp2');

function copyScriptToRemoteMachine(scriptFile : string, scpConfig : any) : Q.Promise<string> {
    var defer = Q.defer<string>();

    Scp2Client.scp(scriptFile, scpConfig, function (err) {
        if (err) {
            defer.reject(tl.loc('RemoteCopyFailed', err));
        } else {
            tl.debug('Copied script file to remote machine at: ' + scpConfig.path);
            defer.resolve(scpConfig.path);
        }
    });

    return defer.promise;
}

function setupSshClientConnection(sshConfig: any) : Q.Promise<any> {
    var defer = Q.defer<any>();
    var client = new Ssh2Client();
    client.on('ready', function () {
        defer.resolve(client);
    }).on('error', function (err) {
        defer.reject(err);
    }).connect(sshConfig);
    return defer.promise;
}

function runCommandOnRemoteMachine(sshClient: any, command: string) : Q.Promise<string> {
    var defer = Q.defer<string>();
    var stdErrWritten:boolean = false;
    var stdout: string = '';

    var cmdToRun = command;
    if(cmdToRun.indexOf(';') > 0) {
        //multiple commands were passed separated by ;
        cmdToRun = cmdToRun.replace(/;/g, '\n');
    }
    tl.debug('cmdToRun = ' + cmdToRun);

    sshClient.exec(cmdToRun, function(err, stream) {
        if(err) {
            defer.reject(tl.loc('RemoteCmdExecutionErr', err))
        }
        stream.on('data', function(data) {
            stdout = stdout.concat(data);
            if(stdout.endsWith('\n')) {
                tl._writeLine(stdout);
                stdout = '';
            }
        }).stderr.on('data', function(data) {
            stdErrWritten = true;
            tl._writeError(data);
        })
        .on('close', function(code, signal) {
            tl._writeLine(stdout);
            if(stdErrWritten === true) {
                defer.reject(tl.loc('RemoteCmdExecutionErr'));
            } else if(code && code != 0) {
                defer.reject(tl.loc('RemoteCmdExecutionErr'));
            } else {
                defer.resolve('0');
            }
        })
    })
    return defer.promise;
}

async function run() {
    var sshClientConnection: any;
    var cleanUpScriptCmd: string;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read SSH endpoint input
        var sshEndpoint = tl.getInput('sshEndpoint', true);
        var username:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
        var password:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional
        var privateKey:string = tl.getEndpointDataParameter(sshEndpoint, 'privateKey', true); //private key is optional, password can be used for connecting
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

        //setup the SSH connection
        tl._writeLine(tl.loc('SettingUpSshConnection', sshConfig.username, sshConfig.host, sshConfig.port));
        try {
            sshClientConnection = await setupSshClientConnection(sshConfig);
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
                    var returnCode:string = await runCommandOnRemoteMachine(sshClientConnection, commands[i]);
                    tl.debug('Command ' + commands[i] + ' completed with return code = ' + returnCode);
                }
            } else if (runOptions === 'script') {
                //run the script specified by the user
                var scpConfig = sshConfig;
                var remoteScript = '/home/' + sshConfig.username + '/' + path.basename(scriptFile);
                scpConfig.path = remoteScript;

                //copy script file to remote machine
                tl.debug('Copying script to remote machine.');
                await copyScriptToRemoteMachine(scriptFile, scpConfig);

                var remoteScriptPath = '"' + remoteScript + '"';
                tl.debug('remoteScriptPath = ' + remoteScriptPath);

                //set execute permissions on the script
                tl.debug('Setting execute permisison on script copied to remote machine');
                tl._writeLine('chmod +x ' + remoteScriptPath);
                await runCommandOnRemoteMachine(sshClientConnection, 'chmod +x ' + remoteScriptPath);

                //run remote script file with args on the remote machine
                var runScriptCmd = remoteScriptPath;
                if (args) {
                    runScriptCmd = runScriptCmd.concat(' ' + args);
                }

                //setup command to clean up script file
                cleanUpScriptCmd = 'rm -f ' + remoteScriptPath;

                tl._writeLine(runScriptCmd);
                await runCommandOnRemoteMachine(sshClientConnection, runScriptCmd);
            }
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //clean up script file if needed
        if(cleanUpScriptCmd) {
            try {
                tl.debug('Deleting the script file copied to the remote machine.');
                await runCommandOnRemoteMachine(sshClientConnection, cleanUpScriptCmd);
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
