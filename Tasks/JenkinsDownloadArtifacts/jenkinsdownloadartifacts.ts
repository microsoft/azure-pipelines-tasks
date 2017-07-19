// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');

const request = require('request');

class Credential {
    mUsername: string;
    mPassword: string;

    constructor(username: string, password: string) {
        this.mUsername = username;
        this.mPassword = password;
    }
}

function getRequest(url: string, cred: Credential, strictSSL: boolean): Q.Promise<any> {
    const defer = Q.defer<any>();

    request
        .get({url: url, strictSSL: strictSSL}, (err, res, body) => {
            if (res && body && res.statusCode === 200)  {
                defer.resolve(JSON.parse(body));
            } else {
                if (res && res.statusCode) {
                   tl.debug(tl.loc('ServerCallErrorCode', res.statusCode));
                }
                if (body) {
                    tl.debug(body);
                }
                defer.reject(new Error(tl.loc('ServerCallFailed')));
            }
        })
        .auth(cred.mUsername, cred.mPassword, true)
        .on('error', (err) => {
            defer.reject(new Error(err));
        });

    return defer.promise;
}

function getLastSuccessful(serverEndpointUrl: string, jobName: string, cred: Credential, strictSSL: boolean): Q.Promise<number> {
    const defer = Q.defer<number>();
    const lastSuccessfulUrl: string = `${serverEndpointUrl}/job/${jobName}/api/json?tree=lastSuccessfulBuild[id,displayname]`;

    getRequest(lastSuccessfulUrl, cred, strictSSL)
    .then((result) => {
        if (result && result['lastSuccessfulBuild']) {
            let lastSuccessfulBuildId = result['lastSuccessfulBuild']['id'];
            if (lastSuccessfulBuildId) {
                defer.resolve(lastSuccessfulBuildId);
            } else {
                defer.reject(new Error(tl.loc('CouldNotGetLastSuccessfuilBuildNumber')));
            }
        } else {
            defer.reject(new Error(tl.loc('CouldNotGetLastSuccessfuilBuildNumber')));
        }
    })
    .fail((err) => { defer.reject(err); });

    return defer.promise;
}

function getArtifactsRelativePaths(serverEndpointUrl: string, jobName: string, jobBuildId: number, cred: Credential, strictSSL: boolean): Q.Promise<string[]> {
    const defer = Q.defer<string[]>();
    const artifactQueryUrl: string = `${serverEndpointUrl}/job/${jobName}/${jobBuildId}/api/json?tree=artifacts[*]`;

    getRequest(artifactQueryUrl, cred, strictSSL)
    .then((result) => {
        if (result && result['artifacts']) {
            let artifacts = result['artifacts'];
            if (artifacts.length === 0) {
                defer.reject(new Error(tl.loc('CouldNotFindArtifacts', jobName, jobBuildId)));
            } else {
                let artifactsRelativePaths = result['artifacts'].map((artifact) => {
                    return artifact['relativePath'];
                });
                defer.resolve(artifactsRelativePaths);
            }
        } else {
            // no artifacts for this job
            defer.reject(new Error(tl.loc('CouldNotFindArtifacts', jobName, jobBuildId)));
        }
    })
    .fail((err) => { defer.reject(err); });

    return defer.promise;
}

async function download(url: string, localFile: string, cred: Credential, strictSSL: boolean): Promise<void> {
    tl.debug(tl.loc('DownloadFileTo', url, localFile));
    await request.get( {url: url, strictSSL: strictSSL} )
        .auth(cred.mUsername, cred.mPassword, true)
        .on('error', (err) => {
            throw new Error(err);
        })
        .pipe(fs.createWriteStream(localFile));

    tl.debug(tl.loc('FileSuccessfullyDownloaded', localFile));
}

function getArtifactUrl(serverEndpointUrl: string, jobName: string, jobBuildId: number, relativePath: string): string {
    return `${serverEndpointUrl}/job/${jobName}/${jobBuildId}/artifact/${relativePath}`;
}

async function doWork() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        const serverEndpoint: string = tl.getInput('serverEndpoint', true);
        const serverEndpointUrl: string = tl.getEndpointUrl(serverEndpoint, false);

        const serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(serverEndpoint, false);
        const username: string = serverEndpointAuth['parameters']['username'];
        const password: string = serverEndpointAuth['parameters']['password'];
        const cred: Credential = (username && password) ? new Credential(username, password) : new Credential('', '');

        const jobName: string = tl.getInput('jobName', true);
        const localPathRoot: string = tl.getPathInput('saveTo', true);

        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(serverEndpoint, 'acceptUntrustedCerts', true));

        const jenkinsBuild: string = tl.getInput('jenkinsBuild', true);
        let buildId: number;
        if (jenkinsBuild === 'LastSuccessfulBuild') {
            tl.debug(tl.loc('GetArtifactsFromLastSuccessfulBuild', jobName));
            buildId = await getLastSuccessful(serverEndpointUrl, jobName, cred, strictSSL);
        } else {
            const buildIdStr: string = tl.getInput('jenkinsBuildNumber');
            buildId = parseInt(buildIdStr);
        }
        tl.debug(tl.loc('GetArtifactsFromBuildNumber', buildId, jobName));

        const artifactsRelativePaths: string[] = await getArtifactsRelativePaths(serverEndpointUrl, jobName, buildId, cred, strictSSL);
        artifactsRelativePaths.forEach((relativePath) => {
            const localPath: string = path.resolve(localPathRoot, relativePath);
            const dir: string = path.dirname(localPath);
            if (!tl.exist(dir)) {
                tl.mkdirP(dir);
            }

            const artifactUrl: string = getArtifactUrl(serverEndpointUrl, jobName, buildId, relativePath);
            //Q: Are we supposed to await on this download call?
            download(artifactUrl, localPath, cred, strictSSL);
        });
    } catch (err) {
        tl.debug(err.message);
        tl._writeError(err);
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

doWork();
