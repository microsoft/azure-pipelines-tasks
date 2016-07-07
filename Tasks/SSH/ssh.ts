/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
var sshClient = require('ssh2').Client;
var scpClient = require('scp2');

function runCommandsUsingSSH(sshConfig, commands) {
    try {
        var stdout:string = '';

        var client = new sshClient();
        client.on('ready', function () {
            tl.debug('SSH connection succeeded, client is ready.');
            client.shell(function (err, stream) {
                if (err) {
                    tl._writeError(err);
                }
                stream.on('close', function () {
                    tl._writeLine(stdout);
                    client.end();
                }).on('data', function (data) {
                    stdout = stdout.concat(data);
                    if (stdout.endsWith('\n')) {
                        tl._writeLine(stdout);
                        stdout = '';
                    }
                }).stderr.on('data', function (data) {
                        tl._writeError(data);
                    });
                stream.end(commands);
            });
        }).on('error', function (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ConnectionFailed', err));
        }).connect(sshConfig);
    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('ConnectionFailed', err));
    }
}

var sshEndpoint = tl.getInput('sshEndpoint', true);
var username:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
var password:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional

var privateKey:string = tl.getEndpointDataParameter(sshEndpoint, 'privateKey', true); //private key is optional, password can be used for connecting
var hostname:string = tl.getEndpointDataParameter(sshEndpoint, 'host', false);
var port:string = tl.getEndpointDataParameter(sshEndpoint, 'port', true); //port is optional, will use 22 as default port if not specified
if(!port || port === '') {
    tl._writeLine('Using port 22 which is the default for SSH since no port was specified.');
    port = '22';
}

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

var runOptions = tl.getInput('runOptions', true);
if(runOptions === 'commands') {
    var commands = tl.getInput('commands', true);
    commands = commands.concat('\nexit\n');
    runCommandsUsingSSH(sshConfig, commands);
} else if (runOptions === 'script') {
    var scriptFile = tl.getPathInput('scriptPath', true, true);
    var args = tl.getInput('args');
    var scpConfig = sshConfig;
    var remoteScript = '/home/' + sshConfig.username + '/' + path.basename(scriptFile);
    scpConfig.path = remoteScript;

    //copy script file to remote machine
    scpClient.scp(scriptFile, scpConfig, function (err) {
        if(err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('RemoteCopyFailed', err));
        } else {
            tl.debug('Copied script file to remote machine at: ' + remoteScript);

            //run remote script file with args on the remote machine
            var remoteCmd = 'bash ';
            if(remoteScript.indexOf(' ') > 0) {
                remoteCmd = remoteCmd.concat('"'+ remoteScript + '"');
            } else {
                remoteCmd = remoteCmd.concat(remoteScript);
            }
            if(args) {
                remoteCmd = remoteCmd.concat(' ' + args);
            }
            remoteCmd = remoteCmd.concat('\n');

            //setup command to clean up script file
            remoteCmd = remoteCmd.concat('rm -f ' + remoteScript);
            remoteCmd = remoteCmd.concat('\nexit\n');

            tl.debug('remoteCmd = ' + remoteCmd);
            runCommandsUsingSSH(sshConfig, remoteCmd);
        }
    })

}