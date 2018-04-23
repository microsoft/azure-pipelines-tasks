import tl = require('vsts-task-lib/task');
import Q = require('q');
var Ssh2Client = require('ssh2').Client;
var Scp2Client = require('scp2');

export class RemoteCommandOptions {
    public failOnStdErr : boolean;
}

/**
 * Uses scp2 to copy a file to remote machine
 * @param scriptFile
 * @param scpConfig
 * @returns {Promise<string>|Promise<T>}
 */
export function copyScriptToRemoteMachine(scriptFile : string, scpConfig : any) : Q.Promise<string> {
    var defer = Q.defer<string>();

    Scp2Client.scp(scriptFile, scpConfig, (err) => {
        if (err) {
            defer.reject(tl.loc('RemoteCopyFailed', err));
        } else {
            tl.debug('Copied script file to remote machine at: ' + scpConfig.path);
            defer.resolve(scpConfig.path);
        }
    });

    return defer.promise;
}

/**
 * Sets up an SSH client connection, when promise is fulfilled, returns the connection object
 * @param sshConfig
 * @returns {Promise<any>|Promise<T>}
 */
export function setupSshClientConnection(sshConfig: any) : Q.Promise<any> {
    var defer = Q.defer<any>();
    var client = new Ssh2Client();
    client.on('ready', () => {
        defer.resolve(client);
    }).on('error', (err) => {
        defer.reject(err);
    }).connect(sshConfig);
    return defer.promise;
}

/**
 * Runs command on remote machine and returns success or failure
 * @param command
 * @param sshClient
 * @param options
 * @returns {Promise<string>|Promise<T>}
 */
export function runCommandOnRemoteMachine(command: string, sshClient: any, options: RemoteCommandOptions) : Q.Promise<string> {
    var defer = Q.defer<string>();
    var stdErrWritten:boolean = false;

    if(!options) {
        tl.debug('Options not passed to runCommandOnRemoteMachine, setting defaults.');
        var options = new RemoteCommandOptions();
        options.failOnStdErr = true;
    }

    var cmdToRun = command;
    if(cmdToRun.indexOf(';') > 0) {
        //multiple commands were passed separated by ;
        cmdToRun = cmdToRun.replace(/;/g, '\n');
    }
    tl.debug('cmdToRun = ' + cmdToRun);

    sshClient.exec(cmdToRun, (err, stream) => {
        if(err) {
            defer.reject(tl.loc('RemoteCmdExecutionErr', err))
        }
        stream.on('close', (code, signal) => {
            tl.debug('code = ' + code + ', signal = ' + signal);

            //based on the options decide whether to fail the build or not if data was written to STDERR
            if(stdErrWritten === true && options.failOnStdErr === true) {
                defer.reject(tl.loc('RemoteCmdExecutionErr'));
            } else if(code && code != 0) {
                defer.reject(tl.loc('RemoteCmdNonZeroExitCode', cmdToRun, code));
            } else {
                //success case - code is undefined or code is 0
                defer.resolve('0');
            }
        }).on('data', (data) => {
            tl._writeLine(data);
        }).stderr.on('data', (data) => {
            stdErrWritten = true;
            tl.debug('stderr = ' + data);
            if(data && data.toString().trim() !== '') {
                tl.error(data);
            }
        });
    });
    return defer.promise;
}
