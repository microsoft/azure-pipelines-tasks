// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');
import request = require('request');

import * as handlers from "item-level-downloader/Providers/Handlers"
import * as providers from "item-level-downloader/Providers"
import * as engine from "item-level-downloader/Engine"

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

    request.get({url: url, strictSSL: strictSSL}, (err, res, body) => {
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
                //TODO: Do we even need an 'error' handler here if we're just re-throwing?
                defer.reject(new Error(err.message));
            });

    return defer.promise;
}

function getLastSuccessful(serverEndpointUrl: string, jobName: string, cred: Credential, strictSSL: boolean): Q.Promise<number> {
    const defer = Q.defer<number>();
    const lastSuccessfulUrl: string = `${serverEndpointUrl}/job/${jobName}/api/json?tree=lastSuccessfulBuild[id,displayname]`;

    getRequest(lastSuccessfulUrl, cred, strictSSL).then((result) => {
            if (result && result['lastSuccessfulBuild']) {
                const lastSuccessfulBuildId = result['lastSuccessfulBuild']['id'];
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

        const artifactQueryUrl: string = `${serverEndpointUrl}/job/${jobName}/${buildId}/api/json?tree=artifacts[*]`;
        console.log(tl.loc('ArtifactDownloadUrl', artifactQueryUrl));

        var templatePath = path.join(__dirname, 'jenkins.handlebars.txt');
        var variables = {
            "endpoint": {
                "url": serverEndpointUrl
            },
            "definition": jobName,
            "version": buildId
        };
        var handler = new handlers.BasicCredentialHandler(username, password);
        
        var webProvider = new providers.WebProvider(artifactQueryUrl, templatePath, variables, handler, { ignoreSslError: !strictSSL });
        var localFileProvider = new providers.FilesystemProvider(localPathRoot);
    
        let downloader = new engine.ArtifactEngine();
        var downloaderOptions = new engine.ArtifactEngineOptions();
        downloaderOptions.itemPattern = tl.getInput('itemPattern', false) || "**";
        downloaderOptions.parallelProcessingLimit = +tl.getVariable("release.artifact.download.parallellimit") || 4;
        var debugMode = tl.getVariable('System.Debug');
        downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;

        await downloader.processItems(webProvider, localFileProvider, downloaderOptions);

        console.log(tl.loc('ArtifactSuccessfullyDownloaded', localPathRoot));
    } catch (err) {
        tl.debug(err.message);
        tl._writeError(err);
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

doWork();
