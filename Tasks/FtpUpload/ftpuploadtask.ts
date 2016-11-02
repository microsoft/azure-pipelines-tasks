import tl = require('vsts-task-lib/task');
import url = require('url');
import Q = require('q');

var Client = require('ftp');

import ftputils = require('./ftputils');

export class FtpOptions {
    // server endpoint
    serverEndpoint: string = tl.getInput('serverEndpoint', true);
    serverEndpointUrl: url.Url = url.parse(tl.getEndpointUrl(this.serverEndpoint, false));

    serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(this.serverEndpoint, false);
    username: string = this.serverEndpointAuth['parameters']['username'];
    password: string = this.serverEndpointAuth['parameters']['password'];

    // other standard options
    rootFolder: string = tl.getPathInput('rootFolder', true);
    filePatterns: string[] = tl.getDelimitedInput('filePatterns', '\n', true);
    remotePath: string = tl.getInput('remotePath', true).trim();

    // advanced options
    clean: boolean = tl.getBoolInput('clean', true);
    overwrite: boolean = tl.getBoolInput('overwrite', true);
    preservePaths: boolean = tl.getBoolInput('preservePaths', true);
    trustSSL: boolean = tl.getBoolInput('trustSSL', true);
}

function doWork() {
    var ftpOptions: FtpOptions = new FtpOptions();
    var ftpClient: any = new Client();
    var ftpHelper: ftputils.FtpHelper = new ftputils.FtpHelper(ftpOptions, ftpClient);

    var files: string[] = ftputils.findFiles(ftpOptions);
    tl.debug('number of files to upload: ' + files.length);
    tl.debug('files to upload: ' + JSON.stringify(files));

    var uploadSuccessful: boolean = false;

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
        var fullMessage: string = 'FTP upload failed: ' + message;
        if (ftpHelper.progressTracking) {
            fullMessage += ftpHelper.progressTracking.getFailureStatusMessage();
        }
        console.log(fullMessage);
        tl.setResult(tl.TaskResult.Failed, message);
    }

    var secure: boolean = ftpOptions.serverEndpointUrl.protocol.toLowerCase() == 'ftps:' ? true : false;
    tl.debug('secure ftp=' + secure);

    var secureOptions: any = { 'rejectUnauthorized': !ftpOptions.trustSSL };

    var hostName: string = ftpOptions.serverEndpointUrl.hostname;
    var port: string = ftpOptions.serverEndpointUrl.port;
    if (!port) { // port not explicitly specifed, use default
        port = '21';
        tl.debug('port not specifided, using default: ' + port);
    }

    console.log('connecting to: ' + hostName + ':' + port);
    ftpClient.connect({ 'host': hostName, 'port': port, 'user': ftpOptions.username, 'password': ftpOptions.password, 'secure': secure, 'secureOptions': secureOptions });
}

doWork();