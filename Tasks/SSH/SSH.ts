/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
var Client = require('ssh2').Client;

function runCommandsUsingSSH(sshConfig, commands) {
    var stdout:string = '';

    var client = new Client();
    client.on('ready', function () {
        tl.debug('Client is ready');
        client.shell(function (err, stream) {
            if (err) {
                tl._writeError(err);
            }
            stream.on('close', function () {
                tl.debug('Stream close');
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
        tl.setResult(tl.TaskResult.Failed, err);
    }).connect(sshConfig);
}

    var hostname: string = tl.getInput('hostname', true);
    var port: number = Number(tl.getInput('port'));
    if(port === NaN) {
        port = 22;
    }
    var username: string = tl.getInput('username', true);
    var password: string = tl.getInput('password');
    var privateKey: string = tl.getInput('privateKey');

    var sshConfig;
    if(privateKey) {
        sshConfig = {
            host: hostname,
            port: port,
            username: username,
            privateKey: privateKey,
            passphrase: password
        }
    } else {
        //use password
        sshConfig = {
            host: hostname,
            port: port,
            username: username,
            password: password
        }
    }

    var commands = tl.getInput('commands');
    if(commands) {
        commands = commands.concat('\nexit\n');
        runCommandsUsingSSH(sshConfig, commands);
    }
