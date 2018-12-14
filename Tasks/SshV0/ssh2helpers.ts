import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as scp2 from 'scp2';
import * as ssh2 from 'ssh2';

export class RemoteCommandOptions {
    public failOnStdErr: boolean;
}

/**
 * Uses scp2 to copy a file to remote machine
 * @param scriptFile
 * @param scpConfig
 * @returns {Promise<string>}
 */
export function copyScriptToRemoteMachine(scriptFile: string, scpConfig: any): Q.Promise<string> {
    const defer = Q.defer<string>();

    scp2.scp(scriptFile, scpConfig, (err) => {
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
 * @returns {Promise<any>}
 */
export function setupSshClientConnection(sshConfig: any): Q.Promise<any> {
    const defer = Q.defer<any>();
    const client = new ssh2.Client();
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
 * @returns {Promise<string>}
 */
export function runCommandOnRemoteMachine(command: string, sshClient: any, options: RemoteCommandOptions): Q.Promise<string> {
    const defer = Q.defer<string>();
    let stdErrWritten: boolean = false;

    if (!options) {
        tl.debug('Options not passed to runCommandOnRemoteMachine, setting defaults.');
        options = new RemoteCommandOptions();
        options.failOnStdErr = true;
    }

    tl.debug('command = ' + command);

    sshClient.exec(command, (err, stream) => {
        if (err) {
            defer.reject(tl.loc('RemoteCmdExecutionErr', err));
        }
        stream.on('close', (code, signal) => {
            tl.debug('code = ' + code + ', signal = ' + signal);

            //based on the options decide whether to fail the build or not if data was written to STDERR
            if (stdErrWritten && options.failOnStdErr) {
                defer.reject(tl.loc('RemoteCmdExecutionErr'));
            } else if (code && code !== 0) {
                defer.reject(tl.loc('RemoteCmdNonZeroExitCode', command, code));
            } else {
                //success case - code is undefined or code is 0
                defer.resolve('0');
            }
        }).on('data', (data) => {
            tl._writeLine(data);
        }).stderr.on('data', (data) => {
            stdErrWritten = true;
            tl.debug('stderr = ' + data);
            if (data && data.toString().trim() !== '') {
                tl.error(data);
            }
        });
    });
    return defer.promise;
}
