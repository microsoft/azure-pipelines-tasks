import tl = require('azure-pipelines-task-lib/task');
var Ssh2Client = require('ssh2').Client;
var SftpClient = require('ssh2-sftp-client');
var path = require('path');

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
        return new Promise((resolve, reject) => {
            this.sshClient = new Ssh2Client();
            this.sshClient.once('ready', () => {
                resolve();
            }).once('error', (err) => {
                reject(tl.loc('ConnectionFailed', err));
            }).connect(this.sshConfig);
        });
    }

    private async setupSftpConnection() : Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                this.sftpClient = new SftpClient();
                await this.sftpClient.connect(this.sshConfig);
                resolve();
            } catch (err) {
                this.sftpClient = null;
                reject(tl.loc('ConnectionFailed', err));
            }
        });
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
                this.sftpClient.on('error', (err) => {
                    tl.debug('sftpClient: Ignoring error diconnecting: ' + err);
                }); // ignore logout errors; see: https://github.com/mscdex/node-imap/issues/695
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
        tl.debug('Upload ' + sourceFile + ' to ' + dest + ' on remote machine.');

        if (!this.sftpClient) {
            return Promise.reject(tl.loc('ConnectionNotSetup'));
        }

        const remotePath = path.dirname(dest);

        if (!tl.getBoolFeatureFlag('COPYFILESOVERSSHV0_USE_QUEUE')) {
            try {

                if (!await this.sftpClient.exists(remotePath)) {
                    await this.sftpClient.mkdir(remotePath, true);
                }
            } catch (error) {
                return Promise.reject(tl.loc('TargetNotCreated', remotePath));
            }
        }

        if (this.sshConfig.useFastPut) {
            return this.sftpClient.fastPut(sourceFile, dest);
        } else {
            return this.sftpClient.put(sourceFile, dest);
        }
    }

    async uploadFolder(sourceFolder: string, destFolder: string) : Promise<string> {
        tl.debug('Upload ' + sourceFolder + ' to ' + destFolder + ' on remote machine.');

        return new Promise(async (resolve, reject) => {
            if (!this.sftpClient) {
                reject(tl.loc('ConnectionNotSetup'));
                return;
            }

            try {
                await this.sftpClient.uploadDir(sourceFolder, destFolder);
                return resolve(destFolder);
            } catch (err) {
                reject(tl.loc('UploadFolderFailed', sourceFolder, destFolder, err));
            }
        });
    }

    /**
     * Returns true if the path exists on remote machine, false if it does not exist
     * @param path
     * @returns {Promise<boolean>}
     */
    async checkRemotePathExists(path: string) : Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            tl.debug(tl.loc('CheckingPathExistance', path));

            if (!this.sftpClient) {
                reject(tl.loc('ConnectionNotSetup'));
                return;
            }

            if (await this.sftpClient.exists(path)) {
                // path exists
                tl.debug(tl.loc('PathExists', path));
                resolve(true);
            } else {
                // path does not exist
                tl.debug(tl.loc('PathNotExists', path));
                resolve(false);
            }
        });
    }

    async createRemoteDirectory(path: string) {
        if (!await this.sftpClient.exists(path)) {
            return await this.sftpClient.mkdir(path, true);
        }
    }

    /**
     * Runs specified command on remote machine, returns error for non-zero exit code
     * @param command
     * @param options
     * @returns {Promise<string>}
     */
    runCommandOnRemoteMachine(command: string, options: RemoteCommandOptions) : Promise<string> {
        return new Promise((resolve, reject) => {
            let stdErrWritten = false;

            if (!this.sshClient) {
                reject(tl.loc('ConnectionNotSetup'));
                return;
            }

            if (!options) {
                tl.debug('Options not passed to runCommandOnRemoteMachine, setting defaults.');
                const options = new RemoteCommandOptions();
                options.failOnStdErr = true;
            }

            let cmdToRun = command;

            if (cmdToRun.indexOf(';') > 0) {
                // multiple commands were passed separated by ;
                cmdToRun = cmdToRun.replace(/;/g, '\n');
            }

            tl.debug('cmdToRun = ' + cmdToRun);

            this.sshClient.exec(cmdToRun, (err, stream) => {
                if (err) {
                    reject(tl.loc('RemoteCmdExecutionErr', cmdToRun, err));
                    return;
                }

                stream.on('close', (code, signal) => {
                    tl.debug('code = ' + code + ', signal = ' + signal);

                    if (code && code != 0) {
                        // non zero exit code - fail
                        reject(tl.loc('RemoteCmdNonZeroExitCode', cmdToRun, code));
                    } else {
                        // no exit code or exit code of 0

                        // based on the options decide whether to fail the build or not if data was written to STDERR
                        if (stdErrWritten === true && options.failOnStdErr === true) {
                            // stderr written - fail the build
                            reject(tl.loc('RemoteCmdExecutionErr', cmdToRun, tl.loc('CheckLogForStdErr')));
                        } else {
                            // success
                            resolve('0');
                        }
                    }
                }).on('data', (data) => {
                    console.log(data.toString());
                }).stderr.on('data', (data) => {
                    stdErrWritten = true;
                    tl.debug('stderr = ' + data);
                    if (data && data.toString().trim() !== '') {
                        tl.error(data);
                    }
                });
            });
        });
    }
}
