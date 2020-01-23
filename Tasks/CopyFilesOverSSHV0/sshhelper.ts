import Q = require('q');
import tl = require('vsts-task-lib/task');
var Ssh2Client = require('ssh2').Client;
var Scp2Client = require('scp2').Client;

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

    private async setupScpConnection() : Promise<void> {
        const defer = Q.defer<void>();
        this.scpClient = new Scp2Client();
        this.scpClient.defaults(this.sshConfig);
        this.scpClient.sftp((err, sftp) => {
            if(err) {
                defer.reject(tl.loc('ConnectionFailed', err));
            } else {
                this.sftpClient = sftp;
                defer.resolve();
            }
        })
        await defer.promise;
    }

    /**
     * Sets up the SSH connection
     */
    async setupConnection() {
        tl._writeLine(tl.loc('SettingUpSSHConnection', this.sshConfig.host));
        try {
            await this.setupSshClientConnection();
            await this.setupScpConnection();
        } catch(err) {
            throw new Error(tl.loc('ConnectionFailed', err));
        }
    }

    /**
     * Close any open client connections for SSH, SCP and SFTP
     */
    closeConnection() {
        try {
            if (this.sftpClient) {
                this.sftpClient.on('error', (err) => {
                    tl.debug('sftpClient: Ignoring error diconnecting: ' + err);
                }); // ignore logout errors; see: https://github.com/mscdex/node-imap/issues/695
                this.sftpClient.close();
                this.sftpClient = null;
            }
        } catch(err) {
            tl.debug('Failed to close SFTP client.');
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
            tl.debug('Failed to close SSH client.');
        }

        try {
            if (this.scpClient) {
                this.scpClient.on('error', (err) => {
                    tl.debug('scpClient: Ignoring error diconnecting: ' + err);
                }); // ignore logout errors; see: https://github.com/mscdex/node-imap/issues/695
                this.scpClient.close();
                this.scpClient = null;
            }
        } catch(err) {
            tl.debug('Failed to close SCP client.');
        }
    }

    /**
     * Uploads a file to the remote server
     * @param sourceFile
     * @param dest, folders will be created if they do not exist on remote server
     * @returns {Promise<string>}
     */
    uploadFile(sourceFile: string, dest: string) : Q.Promise<string> {
        tl.debug('Upload ' + sourceFile + ' to ' + dest + ' on remote machine.');
        var defer = Q.defer<string>();
        if(!this.scpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }
        this.scpClient.upload(sourceFile, dest, (err) => {
            if(err) {
                defer.reject(tl.loc('UploadFileFailed', sourceFile, dest, err));
            } else {
                defer.resolve(dest);
            }
        })
        return defer.promise;
    }

    /**
     * Returns true if the path exists on remote machine, false if it does not exist
     * @param path
     * @returns {Promise<boolean>}
     */
    checkRemotePathExists(path: string) : Q.Promise<boolean> {
        var defer = Q.defer<boolean>();

        if(!this.sftpClient) {
            defer.reject(tl.loc('ConnectionNotSetup'));
        }
        this.sftpClient.stat(path, function(err, attr) {
            if(err) {
                //path does not exist
                defer.resolve(false);
            } else {
                //path exists
                defer.resolve(true);
            }
        })

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
}
