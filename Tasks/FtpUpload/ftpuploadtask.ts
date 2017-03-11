import tl = require('vsts-task-lib/task');
import url = require('url');
import Q = require('q');
import path = require('path');

var Client = require('ftp');

import ftputils = require('./ftputils');

export class FtpOptions {
    // url
    serverEndpointUrl: url.Url;

    // credentials
    username: string;
    password: string

    // other standard options
    rootFolder: string;
    filePatterns: string[];
    remotePath: string;

    // advanced options
    clean: boolean; 
    overwrite: boolean; 
    preservePaths: boolean; 
    trustSSL: boolean; 
}

function getFtpOptions(): FtpOptions {
    let options: FtpOptions = new FtpOptions();

    if (tl.getInput('credsType') === 'serviceEndpoint') {
        // server endpoint
        let serverEndpoint: string = tl.getInput('serverEndpoint', true);
        options.serverEndpointUrl = url.parse(tl.getEndpointUrl(serverEndpoint, false));

        let serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(serverEndpoint, false);
        options.username = serverEndpointAuth['parameters']['username'];
        options.password = serverEndpointAuth['parameters']['password'];
    } else if (tl.getInput('credsType') === 'inputs') {
        options.serverEndpointUrl = url.parse(tl.getInput('serverUrl', true));
        options.username = tl.getInput('username', true);
        options.password = tl.getInput('password', true);
    }

    // other standard options
    options.rootFolder = tl.getPathInput('rootFolder', true);
    options.filePatterns = tl.getDelimitedInput('filePatterns', '\n', true);
    options.remotePath = tl.getInput('remotePath', true).trim();

    // advanced options
    options.clean= tl.getBoolInput('clean', true);
    options.overwrite = tl.getBoolInput('overwrite', true);
    options.preservePaths = tl.getBoolInput('preservePaths', true);
    options.trustSSL = tl.getBoolInput('trustSSL', true);

    return options;
}

function doWork() {
    tl.setResourcePath(path.join( __dirname, 'task.json'));

    var ftpOptions: FtpOptions = getFtpOptions();
    var ftpClient: any = new Client();
    var ftpHelper: ftputils.FtpHelper = new ftputils.FtpHelper(ftpOptions, ftpClient);

    var files: string[] = ftputils.findFiles(ftpOptions);
    tl.debug('number of files to upload: ' + files.length);
    tl.debug('files to upload: ' + JSON.stringify(files));

    var uploadSuccessful: boolean = false;

    ftpClient.on('greeting', (message: string) => {
        tl.debug('ftp client greeting');
        console.log(tl.loc('FTPConnected', message));
    });

    ftpClient.on('ready', async () => {
        tl.debug('ftp client ready');
        try {
            if (ftpOptions.clean) {
                console.log(tl.loc('CleanRemoteDir', ftpOptions.remotePath));
                await ftpHelper.cleanRemote(ftpOptions.remotePath);
            }

            console.log(tl.loc('UploadRemoteDir', ftpOptions.remotePath));
            await ftpHelper.uploadFiles(files);
            uploadSuccessful = true;
            console.log(tl.loc('UploadSucceedMsg', ftpHelper.progressTracking.getSuccessStatusMessage()));

            tl.setResult(tl.TaskResult.Succeeded, tl.loc('UploadSucceedRes'));
        } catch (err) {
            failTask(err);
        } finally {
            console.log(tl.loc('DisconnectHost', ftpOptions.serverEndpointUrl.host));
            ftpClient.end();
            ftpClient.destroy();
        }
    });

    ftpClient.on('close', (hadErr: boolean) => {
        console.log(tl.loc('Disconnected'));
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

    console.log(tl.loc('ConnectPort', hostName, port));
    ftpClient.connect({ 'host': hostName, 'port': port, 'user': ftpOptions.username, 'password': ftpOptions.password, 'secure': secure, 'secureOptions': secureOptions });
}

doWork();