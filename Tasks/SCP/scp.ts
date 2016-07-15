/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import sshHelper = require('./ssh2helpers');
import {RemoteCommandOptions} from './ssh2helpers'

async function run() {
    var sshClientConnection: any;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read SSH endpoint input
        var sshEndpoint = tl.getInput('sshEndpoint', true);
        var username:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
        var password:string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional
        var privateKey:string = tl.getEndpointDataParameter(sshEndpoint, 'privateKey', true); //private key is optional, password can be used for connecting
        var hostname:string = tl.getEndpointDataParameter(sshEndpoint, 'host', false);
        var port:string = tl.getEndpointDataParameter(sshEndpoint, 'port', true); //port is optional, will use 22 as default port if not specified
        if (!port || port === '') {
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

        // contents is a multiline input containing glob patterns
        var contents:string[] = tl.getDelimitedInput('contents', '\n', true);
        var sourceFolder:string = tl.getPathInput('sourceFolder', true, true);
        var targetFolder:string = tl.getInput('targetFolder', true);

        // read the copy options
        var cleanTargetFolder:boolean = tl.getBoolInput('cleanTargetFolder', false);
        var overwrite:boolean = tl.getBoolInput('overwrite', false);
        var flattenFolders:boolean = tl.getBoolInput('flattenFolders', false);

        //setup the SSH connection
        tl._writeLine(tl.loc('SettingUpSshConnection', sshConfig.username, sshConfig.host, sshConfig.port));
        try {
            sshClientConnection = await sshHelper.setupSshClientConnection(sshConfig);
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('ConnectionFailed', err));
            throw tl.loc('ConnectionFailed', err);
        }

        //SSH connection successful
        if(cleanTargetFolder) {
            var cleanTargetFolderCmd = 'cd "' + targetFolder + '";rm -rf *';
            try {
                await
                sshHelper.runCommandOnRemoteMachine(cleanTargetFolderCmd, sshClientConnection, null);
            } catch (err) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('CleanTargetFolderFailed', err));
                throw tl.loc('CleanTargetFolderFailed', err);
            }
        }

    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //close the client connection to halt build execution
        if (sshClientConnection) {
            tl.debug('Closing the SSH client connection.');
            sshClientConnection.end();
        }
    }

}
run();