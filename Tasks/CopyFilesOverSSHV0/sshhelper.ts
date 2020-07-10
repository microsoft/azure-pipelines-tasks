import * as Q from 'q';
import * as tl from 'azure-pipelines-task-lib/task';
import * as SftpClient from 'ssh2-sftp-client';
import { Client as Ssh2Client } from 'ssh2';

export class RemoteCommandOptions {
    public failOnStdErr: boolean;
}

export class SshHelper {
    private sshConfig: any;
    private sshClient: any;
    private sftpClient: any;

    /**
       * Constructor that takes a configuration object of format
       * {
              host: hostname,
              port: port,
              username: username,
              privateKey: privateKey,
              passphrase: passphrase
         }
       * @param sshConfig
       */
    constructor(sshConfig: any) {
        this.sshConfig = sshConfig;
    }

    private async setupSshClientConnection(): Promise<void> {
        const defer = Q.defer<void>();
        this.sshClient = new Ssh2Client();
        this.sshClient
            .once('ready', () => {
                defer.resolve();
            })
            .once('error', (err) => {
                defer.reject(tl.loc('ConnectionFailed', err));
            })
            .connect(this.sshConfig);
        await defer.promise;
    }

    private async setupSftpConnection(): Promise<void> {
        const defer = Q.defer<void>();
        try {
            this.sftpClient = new SftpClient();
            await this.sftpClient.connect(this.sshConfig);
            defer.resolve();
        } catch (err) {
            this.sftpClient = null;
            defer.reject(tl.loc('ConnectionFailed', err));
        }
        await defer.promise;
    }

    /**
     * Sets up the SSH connection
     */
    public async setupConnection() {
        console.log(tl.loc('SettingUpSSHConnection', this.sshConfig.host));
        try {
            await this.setupSshClientConnection();
            await this.setupSftpConnection();
        } catch (err) {
            throw new Error(tl.loc('ConnectionFailed', err));
        }
    }

    /**
     * Close any open client connections for SSH, SCP and SFTP
     */
    public async closeConnection() {
        try {
            if (this.sftpClient) {
                await this.sftpClient.end();
                this.sftpClient = null;
            }
        } catch (err) {
            tl.debug('Failed to close SFTP client: ' + err);
        }
        try {
            if (this.sshClient) {
                this.sshClient.on('error', (err) => {
                    tl.debug('sshClient: Ignoring error diconnecting: ' + err);
                }); // ignore logout errors; see: https://github.com/mscdex/node-imap/issues/695
                this.sshClient.end();
                this.sshClient = null;
            }
        } catch (err) {
            tl.debug('Failed to close SSH client: ' + err);
        }
    }

    /**
     * Uploads a file to the remote server
     * @param sourceFile
     * @param dest, folders will be created if they do not exist on remote server
     * @returns {Promise<string>}
     */
    public async uploadFile(sourceFile: string, dest: string): Promise<string> {
        tl.debug('Upload ' + sourceFile + ' to ' + dest + ' on remote machine.');
        const defer = Q.defer<string>();
        if (!this.sftpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }
        try {
            if (this.sshConfig.useFastPut) {
                await this.sftpClient.fastPut(sourceFile, dest);
            } else {
                await this.sftpClient.put(sourceFile, dest);
            }
            defer.resolve(dest);
        } catch (err) {
            defer.reject(tl.loc('UploadFileFailed', sourceFile, dest, err));
        }
        return defer.promise;
    }

    /**
     * Returns true if the path exists on remote machine, false if it does not exist
     * @param path
     * @returns {Promise<boolean>}
     */
    public async checkRemotePathExists(path: string): Promise<boolean> {
        const defer = Q.defer<boolean>();

        if (!this.sftpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }

        if (await this.sftpClient.stat(path)) {
            //path exists
            defer.resolve(true);
        } else {
            //path does not exist
            defer.resolve(false);
        }

        return defer.promise;
    }

    /**
     * Returns true if the remote path exists and is a directory
     * @param path
     * @returns {Promise<boolean>}
     */
    public async checkRemotePathIsADirectory(path: string): Promise<boolean> {
        const defer = Q.defer<boolean>();

        if (!this.sftpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }

        const remotePathStat = await this.sftpClient.stat(path);
        if (remotePathStat && remotePathStat.isDirectory) {
            // Path exists and is a directory
            defer.resolve(true);
        } else {
            defer.resolve(false);
        }

        return defer.promise;
    }

    /**
     *
     * Ensure that a remote directory exists by trying to create it.  Return true if it does.
     *
     * Relies on the behavior of the ssh2-sftp-client library that if you try to mkdir a directory
     * that exists, it returns successfully.
     * @param path
     * @param recursive
     * @returns {Promise<boolean>}
     */
    public async ensureRemoteDirectory(path: string, recursive: boolean = true) {
        const defer = Q.defer<boolean>();

        if (!this.sftpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }

        try {
            const createRemoteDirectory: string = await this.sftpClient.mkdir(
                path,
                recursive
            );
            defer.resolve(true);
        } catch (err) {
            tl.debug('Could not create  ' + path + ': ' + err.message);
            defer.reject(tl.loc('UnableToCreateDestinationDirectory', path));
        }
    }

    /**
     * Runs specified command on remote machine, returns error for non-zero exit code
     * @param command
     * @param options
     * @returns {Promise<string>}
     */
    public runCommandOnRemoteMachine(
        command: string,
        options: RemoteCommandOptions
    ): Q.Promise<string> {
        const defer = Q.defer<string>();
        let stdErrWritten: boolean = false;

        if (!this.sshClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }

        if (!options) {
            tl.debug(
                'Options not passed to runCommandOnRemoteMachine, setting defaults.'
            );
            const options = new RemoteCommandOptions();
            options.failOnStdErr = true;
        }

        let cmdToRun = command;
        if (cmdToRun.indexOf(';') > 0) {
            //multiple commands were passed separated by ;
            cmdToRun = cmdToRun.replace(/;/g, '\n');
        }
        tl.debug('cmdToRun = ' + cmdToRun);

        this.sshClient.exec(cmdToRun, (err, stream) => {
            if (err) {
                defer.reject(tl.loc('RemoteCmdExecutionErr', cmdToRun, err));
            }
            stream
                .on('close', (code, signal) => {
                    tl.debug('code = ' + code + ', signal = ' + signal);
                    if (code && code !== 0) {
                        //non zero exit code - fail
                        defer.reject(tl.loc('RemoteCmdNonZeroExitCode', cmdToRun, code));
                    } else {
                        //no exit code or exit code of 0

                        //based on the options decide whether to fail the build or not if data was written to STDERR
                        if (stdErrWritten && options.failOnStdErr) {
                            //stderr written - fail the build
                            defer.reject(
                                tl.loc(
                                    'RemoteCmdExecutionErr',
                                    cmdToRun,
                                    tl.loc('CheckLogForStdErr')
                                )
                            );
                        } else {
                            //success
                            defer.resolve('0');
                        }
                    }
                })
                .on('data', (data) => {
                    console.log(data);
                })
                .stderr.on('data', (data) => {
                    stdErrWritten = true;
                    tl.debug('stderr = ' + data);
                    if (data && data.toString().trim() !== '') {
                        tl.error(data);
                    }
                });
        });
        return defer.promise;
    }
}
