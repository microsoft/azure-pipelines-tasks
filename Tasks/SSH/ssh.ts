/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
var Client = require('ssh2').Client;

function runCommandsUsingSSH(sshConfig, commands) {
    try {
        var stdout:string = '';

        var client = new Client();
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
            tl.setResult(tl.TaskResult.Failed, 'Failed to connect to remote machine. Verify the SSH endpoint details. Error: '  + err);
        }).connect(sshConfig);
    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, 'Failed to connect to remote machine. Verify the SSH endpoint details. Error: ' + err);
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

var commands = tl.getInput('commands');
if (commands) {
    commands = commands.concat('\nexit\n');
    runCommandsUsingSSH(sshConfig, commands);
}