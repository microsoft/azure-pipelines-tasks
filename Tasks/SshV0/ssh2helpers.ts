import * as tl from 'azure-pipelines-task-lib/task';
import * as Q from 'q';
import * as scp2 from 'scp2';
import * as ssh2 from 'ssh2';

export class RemoteCommandOptions {
    public failOnStdErr: boolean;
}

/**
 * Inserts user password into stream once it's required
 * @param data text stream data
 * @param stream stream
 * @param password password
 * @param dataBuffer text stream data buffer
 * 
 * @returns true, if password has been sent
 */
function handlePasswordInput(data: string, stream: any, password: string, dataBuffer: string): boolean {
    dataBuffer += data.toString();
    if (dataBuffer.substr(-2) === ': ') {
        stream.write(`${password}\n`);
        dataBuffer = '';

        return true;
    }

    return false;
}

/**
 * Handles error
 * @param data 
 */
function handleError(data: any): void {
    tl.debug('stderr = ' + data);
    if (data && data.toString().trim() !== '') {
        tl.error(data.toString('utf8'));
    }
}

/**
 * Handles stream closing
 * @param command command
 * @param stdErrWritten if true - there was an error written in stream
 * @param defer defer object
 * @param options remote command optios
 * @param code code 
 * @param signal signal
 */
function handleStreamClose(command: string, stdErrWritten: boolean, defer: Q.Deferred<string>, options: RemoteCommandOptions, code: any, signal: any): void {
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
export function runCommandOnRemoteMachine(
    command: string,
    sshClient: ssh2.Client,
    options: RemoteCommandOptions,
    password: string = '',
    interactiveSession: boolean = false
): Q.Promise<string> {
    const defer = Q.defer<string>();
    let stdErrWritten: boolean = false;

    if (!options) {
        tl.debug('Options not passed to runCommandOnRemoteMachine, setting defaults.');
        options = new RemoteCommandOptions();
        options.failOnStdErr = true;
    }

    tl.debug('command = ' + command);
    if (interactiveSession) {
        sshClient.exec(command, { pty: true }, (err, stream) => {
            if (err) {
                defer.reject(tl.loc('RemoteCmdExecutionErr', err));
            }
            let dataBuffer = '';
            let passwordSent = false;
            stream.on('close', (code, signal) => {
                handleStreamClose(command, stdErrWritten, defer, options, code, signal);
            }).on('data', (data) => {
                if (data) {
                    // "data" can be a buffer. Format it here so it outputs as a string
                    console.log(data.toString('utf8'));
                    if (!passwordSent) {
                        passwordSent = handlePasswordInput(data, stream, password, dataBuffer);
                        if (passwordSent) {
                            dataBuffer = '';
                        }
                    }
                }
            }).stderr.on('data', (data) => {
                stdErrWritten = true;
                handleError(data);
            });
            stream.on('exit', function (code, signal) {
                console.log(`>> exited interactive session with code = ${code}, signal = ${signal}`);
                stream.end();
            });
        });
    } else {
        sshClient.exec(command, (err, stream) => {
            if (err) {
                defer.reject(tl.loc('RemoteCmdExecutionErr', err));
            }
            stream.on('close', (code, signal) => {
                handleStreamClose(command, stdErrWritten, defer, options, code, signal);
            }).on('data', (data) => {
                if (data) {
                    // "data" can be a buffer. Format it here so it outputs as a string
                    console.log(data.toString('utf8'));
                }
            }).stderr.on('data', (data) => {
                stdErrWritten = true;
                handleError(data);
            });
        });
    }
    return defer.promise;
}
