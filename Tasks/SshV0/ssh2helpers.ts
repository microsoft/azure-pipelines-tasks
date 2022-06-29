import * as tl from 'azure-pipelines-task-lib/task';
import * as Q from 'q';
import * as ssh2 from 'ssh2';
import * as SftpClient from 'ssh2-sftp-client';

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
 * @param options remote command options
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
 * Uses sftp to copy a file to remote machine
 * @param {string} absolutePath - Data source for data to copy to the remote server.
 * @param {string} remotePath - Path to the remote file to be created on the server.
 * @param {SftpClient.ConnectOptions} sftpConfig
 * @returns {Promise<string>}
 */
export async function copyScriptToRemoteMachine(absolutePath: string, remotePath: string, sftpConfig: SftpClient.ConnectOptions): Promise<string> {
    const defer = Q.defer<string>();
    const sftpClient = new SftpClient();

    try {
        await sftpClient.connect(sftpConfig);
        await sftpClient.put(absolutePath, remotePath);
        tl.debug(`Copied script file to remote machine at: ${remotePath}`);
        defer.resolve();
    } catch (err) {
        defer.reject(tl.loc('RemoteCopyFailed', err));
    }

    try {
        sftpClient.on('error', (err) => {
            tl.debug(`sftpClient: Ignoring error diconnecting: ${err}`);
        }); // ignore logout errors - since there could be spontaneous ECONNRESET errors after logout; see: https://github.com/mscdex/node-imap/issues/695
        await sftpClient.end();
    } catch(err) {
        tl.debug(`Failed to close SFTP client: ${err}`);
    }
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
    }).on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => { finish([sshConfig.password]); })
    .connect(sshConfig);
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
            stream.on('exit', function (code: any, signal: any) {
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

/**
 * Interface for working with scp2 package API
 *
 * @interface ScpConfig
 */
export interface ScpConfig {
    /** Hostname or IP address of the server. */
    host: string;
    /** Port number of the server. */
    port: number;
    /** Username for authentication. */
    username: string;
    /** Password for password-based user authentication. */
    password?: string;
    /** String that contains a private key for either key-based or hostbased user authentication (OpenSSH format). */
    privateKey?: string;
    /** For an encrypted private key, this is the passphrase used to decrypt it. */
    passphrase?: string;
}

/**
 * This function generates a new file with *_unix extension on the remote host
 * which contains the same file but without Windows CR LF
 * @param {ssh2.Client} sshClientConnection - ssh client instance
 * @param {RemoteCommandOptions} remoteCmdOptions
 * @param {string} remoteInputFilePath - remote path to target file
 * @throws will throw an error if command execution fails on remote host
 * @return {string} - path to the generated file
*/
export async function clearFileFromWindowsCRLF(sshClientConnection: ssh2.Client, remoteCmdOptions: RemoteCommandOptions, remoteInputFilePath: string): Promise<string> {
    const remoteOutputFilePath = `${remoteInputFilePath}._unix`;
    const removeLineEndingsCmd = `tr -d \'\\015\' <${remoteInputFilePath}> ${remoteOutputFilePath}`;

    console.log(removeLineEndingsCmd);

    try {
        tl.debug(`Removing Windows CR LF from ${remoteInputFilePath}`);
        await runCommandOnRemoteMachine(removeLineEndingsCmd, sshClientConnection, remoteCmdOptions);
    } catch (error) {
        throw new Error(error);
    }

    tl.debug(`Path to generated file = ${remoteOutputFilePath}`);

    return remoteOutputFilePath;
}
