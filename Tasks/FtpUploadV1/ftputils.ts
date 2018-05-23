import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');

import task = require('./ftpuploadtask');
import FtpOptions = task.FtpOptions;


export class FtpHelper {
    ftpOptions: FtpOptions = null;
    ftpClient: any = null;
    progressTracking: ProgressTracking = null;

    constructor(ftpOptions: FtpOptions, ftpClient: any) {
        this.ftpOptions = ftpOptions;
        this.ftpClient = ftpClient;
    }

    createRemoteDirectory(remoteDirectory: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();

        tl.debug('creating remote directory: ' + remoteDirectory);

        this.ftpClient.mkdir(remoteDirectory, true, function (err) {
            if (err) {
                defer.reject('Unable to create remote directory: ' + remoteDirectory + ' due to error: ' + err);
            } else {
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    uploadFile(file: string, remoteFile: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();

        tl.debug('uploading file: ' + file + ' remote: ' + remoteFile);

        this.ftpClient.put(file, remoteFile, function (err) {
            if (err) {
                defer.reject('upload failed: ' + remoteFile + ' due to error: ' + err);
            } else {
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    remoteExists(remoteFile: string): Q.Promise<boolean> {
        let defer: Q.Deferred<boolean> = Q.defer<boolean>();

        tl.debug('checking if remote exists: ' + remoteFile);

        let remoteDirname = path.normalize(path.dirname(remoteFile));
        let remoteBasename = path.basename(remoteFile);

        this.ftpClient.list(remoteDirname, function (err, list) {
            if (err) {
                //err.code == 550  is the standard not found error
                //but just resolve false for all errors
                defer.resolve(false);
            } else {
                for (let remote of list) {
                    if (remote.name == remoteBasename) {
                        defer.resolve(true);
                        return;
                    }
                }
                defer.resolve(false);
            }
        });

        return defer.promise;
    }

    rmdir(remotePath: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();

        tl.debug('removing remote directory: ' + remotePath);

        this.ftpClient.rmdir(remotePath, true, function (err) {
            if (err) {
                defer.reject('Unable to remove remote folder: ' + remotePath + ' error: ' + err);
            } else {
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    remoteDelete(remotePath: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();

        tl.debug('removing remote content: ' + remotePath);

        this.ftpClient.delete(remotePath, function (err) {
            if (err) {
                defer.reject('Unable to remove remote content: ' + remotePath + ' error: ' + err);
            } else {
                defer.resolve(null);
            }
        });

        return defer.promise;
    }

    async cleanRemote(remotePath: string) {
        tl.debug('cleaning remote directory: ' + remotePath);

        if (await this.remoteExists(remotePath)) {
            await this.rmdir(remotePath);
        }
    }

    async cleanRemoteContents(remotePath: string) {
        tl.debug('cleaning remote directory contents: ' + remotePath);
       
        let that: any = this;
        let defer: Q.Deferred<void> = Q.defer<void>();
        this.ftpClient.list(path.normalize(remotePath), async function (err, list) {
            try {
                if (!err) {
                    for (let remote of list) {
                        let item = path.join(remotePath, remote.name);
                        if (remote.type === 'd') { // directories
                            await that.rmdir(item);
                        } else {
                            await that.remoteDelete(item);
                        }
                    }
                }
                defer.resolve(null);
            } catch(err) {
                defer.reject('Error cleaning remote path: ' + err);
            }
        });
        return defer.promise;
    }

    uploadFiles(files: string[]): Q.Promise<void> {
        let thisHelper = this;
        thisHelper.progressTracking = new ProgressTracking(thisHelper.ftpOptions, files.length + 1); // add one extra for the root directory
        tl.debug('uploading files');

        let defer: Q.Deferred<void> = Q.defer<void>();

        let outerPromises: Q.Promise<void>[] = []; // these run first, and their then clauses add more promises to innerPromises
        let innerPromises: Q.Promise<void>[] = [];
        outerPromises.push(this.createRemoteDirectory(thisHelper.ftpOptions.remotePath).then(() => {
            thisHelper.progressTracking.directoryProcessed(thisHelper.ftpOptions.remotePath);
        })); // ensure root remote location exists

        files.forEach((file) => {
            tl.debug('file: ' + file);
            let remoteFile: string = thisHelper.ftpOptions.preservePaths ?
                path.join(thisHelper.ftpOptions.remotePath, file.substring(thisHelper.ftpOptions.rootFolder.length)) :
                path.join(thisHelper.ftpOptions.remotePath, path.basename(file));

            remoteFile = remoteFile.replace(/\\/gi, "/"); // use forward slashes always
            tl.debug('remoteFile: ' + remoteFile);

            let stats = tl.stats(file);
            if (stats.isDirectory()) { // create directories if necessary
                outerPromises.push(thisHelper.createRemoteDirectory(remoteFile).then(() => {
                    thisHelper.progressTracking.directoryProcessed(remoteFile);
                }));
            } else if (stats.isFile()) { // upload files
                if (thisHelper.ftpOptions.overwrite) {
                    outerPromises.push(thisHelper.uploadFile(file, remoteFile).then(() => {
                        thisHelper.progressTracking.fileUploaded(file, remoteFile);
                    }));
                } else {
                    outerPromises.push(thisHelper.remoteExists(remoteFile).then((exists: boolean) => {
                        if (!exists) {
                            innerPromises.push(thisHelper.uploadFile(file, remoteFile).then(() => {
                                thisHelper.progressTracking.fileUploaded(file, remoteFile);
                            }));
                        } else {
                            thisHelper.progressTracking.fileSkipped(file, remoteFile);
                        }
                    }));
                }
            }
        });

        Q.all(outerPromises).then(() => {
            Q.all(innerPromises).then(() => {
                defer.resolve(null);
            }).fail((err) => {
                defer.reject(err);
            })
        }).fail((err) => {
            defer.reject(err);
        });

        return defer.promise;
    }
}

export class ProgressTracking {
    ftpOptions: FtpOptions = null;
    fileCount: number = -1;

    progressFilesUploaded: number = 0;
    progressFilesSkipped: number = 0; // already exists and overwrite mode off
    progressDirectoriesProcessed: number = 0;

    constructor(ftpOptions: FtpOptions, fileCount: number) {
        this.ftpOptions = ftpOptions;
        this.fileCount = fileCount;
    }

    directoryProcessed(name: string): void {
        this.progressDirectoriesProcessed++;
        this.printProgress('remote directory successfully created/verified: ' + name);
    }

    fileUploaded(file: string, remoteFile: string): void {
        this.progressFilesUploaded++;
        this.printProgress('successfully uploaded: ' + file + ' to: ' + remoteFile);
    }

    fileSkipped(file: string, remoteFile: string): void {
        this.progressFilesSkipped++;
        this.printProgress('skipping file: ' + file + ' remote: ' + remoteFile + ' because it already exists');
    }

    printProgress(message: string): void {
        let total: number = this.progressFilesUploaded + this.progressFilesSkipped + this.progressDirectoriesProcessed;
        let remaining: number = this.fileCount - total;
        console.log(
            'files uploaded: ' + this.progressFilesUploaded +
            ', files skipped: ' + this.progressFilesSkipped +
            ', directories processed: ' + this.progressDirectoriesProcessed +
            ', total: ' + total + ', remaining: ' + remaining +
            ', ' + message);
    }

    getSuccessStatusMessage(): string {
        return '\nhost: ' + this.ftpOptions.serverEndpointUrl.host +
            '\npath: ' + this.ftpOptions.remotePath +
            '\nfiles uploaded: ' + this.progressFilesUploaded +
            '\nfiles skipped: ' + this.progressFilesSkipped +
            '\ndirectories processed: ' + this.progressDirectoriesProcessed;
    }

    getFailureStatusMessage() {
        let total: number = this.progressFilesUploaded + this.progressFilesSkipped + this.progressDirectoriesProcessed;
        let remaining: number = this.fileCount - total;
        return this.getSuccessStatusMessage() +
            '\nunprocessed files & directories: ' + remaining;
    }
}



export function findFiles(ftpOptions: FtpOptions): string[] {
    tl.debug('Searching for files to upload');

    let rootFolderStats = tl.stats(ftpOptions.rootFolder);
    if (rootFolderStats.isFile()) {
        let file = ftpOptions.rootFolder;
        tl.debug(file + ' is a file. Ignoring all file patterns');
        return [file];
    }

    let allFiles = tl.find(ftpOptions.rootFolder);

    // filePatterns is a multiline input containing glob patterns
    tl.debug('searching for files using: ' + ftpOptions.filePatterns.length + ' filePatterns: ' + ftpOptions.filePatterns);

    // minimatch options
    let matchOptions = { matchBase: true, dot: true };
    let win = tl.osType().match(/^Win/);
    tl.debug('win: ' + win);
    if (win) {
        matchOptions["nocase"] = true;
    }

    tl.debug('Candidates found for match: ' + allFiles.length);
    for (let i = 0; i < allFiles.length; i++) {
        tl.debug('file: ' + allFiles[i]);
    }

    // use a set to avoid duplicates
    let matchingFilesSet: Set<string> = new Set();

    for (let i = 0; i < ftpOptions.filePatterns.length; i++) {
        let normalizedPattern: string = path.join(ftpOptions.rootFolder, path.normalize(ftpOptions.filePatterns[i]));

        tl.debug('searching for files, pattern: ' + normalizedPattern);

        let matched = tl.match(allFiles, normalizedPattern, matchOptions);
        tl.debug('Found total matches: ' + matched.length);
        // ensure each result is only added once
        for (let j = 0; j < matched.length; j++) {
            let match = path.normalize(matched[j]);
            let stats = tl.stats(match);
            if (!ftpOptions.preservePaths && stats.isDirectory()) {
                // if not preserving paths, skip all directories
            } else if (matchingFilesSet.add(match)) {
                tl.debug('adding ' + (stats.isFile() ? 'file:   ' : 'folder: ') + match);
                if (stats.isFile() && ftpOptions.preservePaths) {
                    // if preservePaths, make sure the parent directory is also included
                    let parent = path.normalize(path.dirname(match));
                    if (matchingFilesSet.add(parent)) {
                        tl.debug('adding folder: ' + parent);
                    }
                }
            }
        }
    }
    return Array.from(matchingFilesSet).sort();
}