/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />

import fs = require('fs');
import os = require('os');
import path = require('path');
import tl = require('vsts-task-lib/task');
import url = require('url');

var SortedSet = require('collections/sorted-set');
var Client = require('ftp');

var win = os.type().match(/^Win/);
tl.debug('win: ' + win);

var repoRoot: string = tl.getVariable('build.sourcesDirectory');
function makeAbsolute(normalizedPath: string): string {
    tl.debug('makeAbsolute:' + normalizedPath);

    var result = normalizedPath;
    if (!path.isAbsolute(normalizedPath)) {
        result = path.join(repoRoot, normalizedPath);
        tl.debug('Relative file path: ' + normalizedPath + ' resolving to: ' + result);
    }
    return result;
}

// server endpoint
var serverEndpoint = tl.getInput('serverEndpoint', true);
var serverEndpointUrl : url.Url = url.parse(tl.getEndpointUrl(serverEndpoint, false));

var serverEndpointAuth = tl.getEndpointAuthorization(serverEndpoint, false);
var username = serverEndpointAuth['parameters']['username'];
var password = serverEndpointAuth['parameters']['password'];

// the root location which will be uploaded from
var rootFolder: string = makeAbsolute(path.normalize(tl.getPathInput('rootFolder', true).trim()));
if (!tl.exist(rootFolder)) {
    failTask('The specified root folder does not exist: ' + rootFolder );
}

var clean: boolean = tl.getBoolInput('clean', true);
var overwrite: boolean = tl.getBoolInput('overwrite', true);
var preservePaths: boolean = tl.getBoolInput('preservePaths', true);

function findFiles(): string[] {
    tl.debug('Searching for files to upload');

    var rootFolderStats = tl.stats(rootFolder);
    if (rootFolderStats.isFile()) {
        var file = rootFolder;
        tl.debug(file + ' is a file. Ignoring all file patterns');
        return [file];
    }

    var allFiles = tl.find(rootFolder);

    // filePatterns is a multiline input containing glob patterns
    var filePatterns: string[] = tl.getDelimitedInput('filePatterns', '\n', true);

    for (var i = 0; i < filePatterns.length; i++) {
        if (filePatterns[i] == '*') {
            if(preservePaths){
                tl.debug('* matching everything, total: ' + allFiles.length);
                return allFiles;
            } else {
                var filesToUpload = [];
                // strip out all directories
                for(var file of allFiles){
                    var stats = tl.stats(file);
                    if (stats.isFile()) {
                        tl.debug('adding file: ' + file);
                        filesToUpload.push(file);
                    } 
                }
                tl.debug('* matching everything, total: ' + filesToUpload.length);
                return filesToUpload;
            }
        }
    }

    tl.debug('searching for files using: ' + filePatterns.length + ' filePatterns: ' + filePatterns);

    // minimatch options
    var matchOptions = { matchBase: true };
    if (win) {
        matchOptions["nocase"] = true;
    }

    tl.debug('Candidates found for match: ' + allFiles.length);
    for (var i = 0; i < allFiles.length; i++) {
        tl.debug('file: ' + allFiles[i]);
    }

    // use a set to avoid duplicates
    var matchingFilesSet = new SortedSet();

    for (var i = 0; i < filePatterns.length; i++) {
        var normalizedPattern: string = path.join(rootFolder, path.normalize(filePatterns[i]));

        tl.debug('searching for files, pattern: ' + normalizedPattern);

        var matched = tl.match(allFiles, normalizedPattern, matchOptions);
        tl.debug('Found total matches: ' + matched.length);
        // ensure each result is only added once
        for (var j = 0; j < matched.length; j++) {
            var match = path.normalize(matched[j]);
            if (matchingFilesSet.add(match)) {
                var stats = tl.stats(match);
                tl.debug('adding ' + (stats.isFile() ? 'file:   ' : 'folder: ') + match);
                if (stats.isFile()) {
                    var parent = path.normalize(path.dirname(match));
                    if (matchingFilesSet.add(parent)) {
                        tl.debug('adding folder: ' + parent);
                    }
                }
            }
        }
    }
    return matchingFilesSet.sorted();
}

var remotePath = tl.getInput('remotePath', true).trim();

var filesUploaded: number = 0;
var filesSkipped: number = 0; // already exists and overwrite mode off
var directoriesProcessed: number = 0;

var files = findFiles();

var c = new Client();

function checkDone(message: string): void {
    var total: number = filesUploaded + filesSkipped + directoriesProcessed;
    var remaining: number = files.length - total + 1; // add one for the root remotePath
    console.log( 
        'files uploaded: ' + filesUploaded +
        ', files skipped: ' + filesSkipped +
        ', directories processed: ' + directoriesProcessed +
        ', total: ' + total + ', remaining: ' + remaining +
        ', '+message);
    if (remaining == 0) {
        c.end();
        tl.setResult(tl.TaskResult.Succeeded, 'FTP upload successful' + getFinalStatusMessage());
    }
}

function getFinalStatusMessage() : string {
    return '\nhost: ' + serverEndpointUrl.host +
        '\npath: ' + remotePath +
        '\nfiles uploaded: ' + filesUploaded +
        '\nfiles skipped: ' + filesSkipped +
        '\ndirectories processed: ' + directoriesProcessed;
}

function failTask(message: string) {
    if(files) {
        var total: number = filesUploaded + filesSkipped + directoriesProcessed;
        var remaining: number = files.length - total;
        message = message + getFinalStatusMessage() + '\nunprocessed files & directories: '+ remaining;
    }
    tl.setResult(tl.TaskResult.Failed, message);
    tl.exit(1);
}

function uploadFiles() {
    tl.debug('files to process: ' + files.length);

    createRemoteDirectory(remotePath); // ensure root remote location exists

    files.forEach((file) => {
        tl.debug('file: ' + file);
        var remoteFile: string = preservePaths ?
            path.join(remotePath, file.substring(rootFolder.length)) :
            path.join(remotePath, path.basename(file));

        remoteFile = remoteFile.replace(/\\/gi, "/"); // use forward slashes always
        tl.debug('remoteFile: ' + remoteFile);

        var stats = tl.stats(file);
        if (stats.isDirectory()) { // create directories if necessary
            createRemoteDirectory(remoteFile);
        } else if (stats.isFile()) { // upload files
            if (overwrite) {
                uploadFile(file, remoteFile);
            } else {
                remoteExists(remoteFile, function(exists: boolean){
                    if(!exists){
                        uploadFile(file, remoteFile);
                    } else {
                        filesSkipped++;
                        checkDone('skipping file: ' + file + ' remote: ' + remoteFile + ' because it already exists');
                    }
                });
            }
        }
    });
}

// only called in no overwrite mode
function remoteExists(remoteFile : string, callback){
    var remoteDirname = path.normalize(path.dirname(remoteFile));
    var remoteBasename = path.basename(remoteFile);
    //todo -- optimize to cache information
    c.list(remoteDirname, function (err, list) {
        if(err){
            if (err.code == 550){ // standard not found error
                callback(false);
            } else { // some other error -- just return false --
                callback(false);
            }
            return false;
        } else {
            for (var remote of list) {
                if (remote.name == remoteBasename) {
                    callback(true);
                    return;
                }
            }
            callback(false);
            return true;
        }
    });
}

function createRemoteDirectory(remoteDirectory: string) {
    tl.debug('creating remote directory: ' + remoteDirectory);
    c.mkdir(remoteDirectory, true, function (err) {
        if (err) {
            c.end();
            failTask('Unable to create remote directory: ' + remoteDirectory + ' due to error: ' + err);
        }
        directoriesProcessed++;
        checkDone('remote directory successfully created/verified: ' + remoteDirectory);
    });
}

function uploadFile(file: string, remoteFile) {
    tl.debug('uploading file: ' + file + ' remote: ' + remoteFile);
    c.put(file, remoteFile, function (err) {
        if (err) {
            c.end();
            failTask('upload failed: ' + remoteFile + ' due to error: ' + err);
        } else {
            filesUploaded++;
            checkDone('successfully uploaded: '+ file + ' to: ' + remoteFile);
        }
    });
}

c.on('ready', function () {
    tl.debug('connected to ftp host:' + serverEndpointUrl.host);

    if (clean) {
        tl.debug('cleaning remote: ' + remotePath);
        remoteExists(remotePath, function(exists){
            if(exists){
                c.rmdir(remotePath, true, function (err) {
                    if (err) {
                        c.destroy();
                        failTask('Unable to clean remote folder: ' + remotePath + ' error: ' + err);
                    }
                    uploadFiles();
                });
            } else {
                uploadFiles();
            }
        });
    } else {
        tl.debug('skipping clean: ' + remotePath);
        uploadFiles();
    }
});

var secure = serverEndpointUrl.protocol.toLowerCase() == 'ftps:' ? true : false;
tl.debug('secure ftp=' + secure);

c.connect({ 'host': serverEndpointUrl.host, 'user': username, 'password': password, 'secure': secure });