/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />

import tl = require('vsts-task-lib/task');
import url = require('url');
import Q = require('q');

var Client = require('ftp');

import ftputils = require('./ftputils');

export class FtpOptions {
    // server endpoint
    serverEndpoint = tl.getInput('serverEndpoint', true);
    serverEndpointUrl: url.Url = url.parse(tl.getEndpointUrl(this.serverEndpoint, false));

    serverEndpointAuth = tl.getEndpointAuthorization(this.serverEndpoint, false);
    username = this.serverEndpointAuth['parameters']['username'];
    password = this.serverEndpointAuth['parameters']['password'];

    // other standard options
    rootFolder: string = tl.getPathInput('rootFolder', true);
    filePatterns: string[] = tl.getDelimitedInput('filePatterns', '\n', true);
    remotePath = tl.getInput('remotePath', true).trim();

    // advanced options
    clean: boolean = tl.getBoolInput('clean', true);
    overwrite: boolean = tl.getBoolInput('overwrite', true);
    preservePaths: boolean = tl.getBoolInput('preservePaths', true);
    rejectUnauthorized: boolean = tl.getBoolInput('rejectUnauthorized', true);
}

function doWork() {
    var ftpOptions = new FtpOptions();
    var ftpClient = new Client();
    var ftpHelper = new ftputils.FtpHelper(ftpOptions, ftpClient);

    var files = ftputils.findFiles(ftpOptions);
    tl.debug('number of files to upload: ' + files.length);
    tl.debug('files to upload: ' + JSON.stringify(files));

    var uploadSuccessful = false;

    ftpClient.on('greeting', (message: string) => {
        tl.debug('ftp client greeting');
        console.log('connected: ' + message);
    });

    ftpClient.on('ready', async () => {
        tl.debug('ftp client ready');
        try {
            if (ftpOptions.clean) {
                console.log('cleaning remote directory: ' + ftpOptions.remotePath);
                await ftpHelper.cleanRemote(ftpOptions.remotePath);
            }

            console.log('uploading files to remote directory: ' + ftpOptions.remotePath);
            await ftpHelper.uploadFiles(files);
            uploadSuccessful = true;
            console.log('FTP upload successful ' + ftpHelper.progressTracking.getSuccessStatusMessage());

            tl.setResult(tl.TaskResult.Succeeded, 'FTP upload successful');
        } catch (err) {
            failTask(err);
        } finally {
            console.log('disconnecting from: ', ftpOptions.serverEndpointUrl.host);
            ftpClient.end();
            ftpClient.destroy();
        }
    });

    ftpClient.on('close', (hadErr: boolean) => {
        console.log('disconnected');
        tl.debug('ftp client close, hadErr:' + hadErr);
    });

    ftpClient.on('end', () => {
        tl.debug('ftp client end');
    })

    ftpClient.on('error', (err) => {
        tl.debug('ftp client error, err: ' + err);
        if (!uploadSuccessful) {
            // once all files are successfully uploaded, a subsequent error should not fail the task
            failTask(err);
        }
    })

    function failTask(message: string): void {
        var fullMessage = 'FTP upload failed: ' + message;
        if (ftpHelper.progressTracking) {
            fullMessage += ftpHelper.progressTracking.getFailureStatusMessage();
        }
        console.log(fullMessage);
        tl.setResult(tl.TaskResult.Failed, message);
    }

    var secure = ftpOptions.serverEndpointUrl.protocol.toLowerCase() == 'ftps:' ? true : false;
    tl.debug('secure ftp=' + secure);

    var secureOptions = { 'rejectUnauthorized': ftpOptions.rejectUnauthorized };

    console.log('connecting to: ' + ftpOptions.serverEndpointUrl.host);
    ftpClient.connect({ 'host': ftpOptions.serverEndpointUrl.host, 'user': ftpOptions.username, 'password': ftpOptions.password, 'secure': secure, 'secureOptions': secureOptions });
}

doWork();