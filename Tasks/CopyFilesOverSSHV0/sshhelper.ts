import Q = require('q');
import tl = require('azure-pipelines-task-lib/task');
const path = require('path');
var Ssh2Client = require('ssh2').Client;
var SftpClient = require('ssh2-sftp-client');

export class RemoteCommandOptions {
    public failOnStdErr : boolean;
}

export class SshHelper {
    private sshConfig: any;
    private sshClient: any;
    private scpClient: any;
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

    private async setupSshClientConnection() : Promise<void> {
        const defer = Q.defer<void>();
        this.sshClient = new Ssh2Client();
        this.sshClient.once('ready', () => {
            defer.resolve();
        }).once('error', (err) => {
            defer.reject(tl.loc('ConnectionFailed', err));
        }).connect(this.sshConfig);
        await defer.promise;
    }

    private async setupSftpConnection() : Promise<void> {
        const defer = Q.defer<void>();
        try {
            this.sftpClient = new SftpClient();
            await this.sftpClient.connect(this.sshConfig)
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
    async setupConnection() {
        console.log(tl.loc('SettingUpSSHConnection', this.sshConfig.host));
        try {
            await this.setupSshClientConnection();
            await this.setupSftpConnection();
        } catch(err) {
            throw new Error(tl.loc('ConnectionFailed', err));
        }
    }

    /**
     * Close any open client connections for SSH, SCP and SFTP
     */
    async closeConnection() {
        try {
            if (this.sftpClient) {
                await this.sftpClient.end();
                this.sftpClient = null;
            }
        } catch(err) {
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
        } catch(err) {
            tl.debug('Failed to close SSH client: ' + err);
        }
    }

    /**
     * Uploads a file to the remote server
     * @param sourceFile
     * @param dest, folders will be created if they do not exist on remote server
     * @returns {Promise<string>}
     */
    async uploadFile(sourceFile: string, dest: string) : Promise<string> {
        if (process.platform === 'win32') {
            dest = dest.replace(/\\/g, '/');
        }

        tl.debug('Upload ' + sourceFile + ' to ' + dest + ' on remote machine.');

        var defer = Q.defer<string>();
        if(!this.sftpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }

        const remotePath = path.dirname(dest);
        try {
            if (!await this.sftpClient.exists(remotePath)) {
                await this.sftpClient.mkdir(remotePath, true);
            }
        } catch (error) {
            defer.reject(tl.loc('TargetNotCreated', remotePath));
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
    async checkRemotePathExists(path: string) : Promise<boolean> {
        var defer = Q.defer<boolean>();

        if(!this.sftpClient) {
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
     * Runs specified command on remote machine, returns error for non-zero exit code
     * @param command
     * @param options
     * @returns {Promise<string>}
     */
    runCommandOnRemoteMachine(command: string, options: RemoteCommandOptions) : Q.Promise<string> {
        var defer = Q.defer<string>();
        var stdErrWritten:boolean = false;

        if(!this.sshClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }

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

        this.sshClient.exec(cmdToRun, (err, stream) => {
            if(err) {
                defer.reject(tl.loc('RemoteCmdExecutionErr', cmdToRun, err))
            }
            stream.on('close', (code, signal) => {
                tl.debug('code = ' + code + ', signal = ' + signal);
                if(code && code != 0) {
                    //non zero exit code - fail
                    defer.reject(tl.loc('RemoteCmdNonZeroExitCode', cmdToRun, code));
                } else {
                    //no exit code or exit code of 0

                    //based on the options decide whether to fail the build or not if data was written to STDERR
                    if(stdErrWritten === true && options.failOnStdErr === true) {
                        //stderr written - fail the build
                        defer.reject(tl.loc('RemoteCmdExecutionErr', cmdToRun, tl.loc('CheckLogForStdErr')));
                    } else {
                        //success
                        defer.resolve('0');
                    }
                }
            }).on('data', (data) => {
                console.log(data);
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
}
