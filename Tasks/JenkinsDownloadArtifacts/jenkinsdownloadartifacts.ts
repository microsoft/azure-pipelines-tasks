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

import {ArtifactDetailsDownloader} from "./ArtifactDetails/ArtifactDetailsDownloader"
import BlobService = require('azure-blobstorage-artifactProvider/blobservice');

import armStorage = require('azure-arm-rest/azure-arm-storage');
import msRestAzure = require("azure-arm-rest/azure-arm-common");

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

    request.get({ url: url, strictSSL: strictSSL }, (err, res, body) => {
        if (res && body && res.statusCode === 200) {
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

async function getArtifactsFromUrl(artifactQueryUrl: string, strictSSL: boolean, localPathRoot: string, itemPattern: string, handler: handlers.BasicCredentialHandler, variables: { [key: string]: any }) {
    console.log(tl.loc('Downloading Artifacts from ArtifactDownloadUrl', artifactQueryUrl));

    var templatePath = path.join(__dirname, 'jenkins.handlebars.txt');
    var webProvider = new providers.WebProvider(artifactQueryUrl, templatePath, variables, handler, { ignoreSslError: !strictSSL });
    var localFileProvider = new providers.FilesystemProvider(localPathRoot);

    var downloaderOptions = new engine.ArtifactEngineOptions();
    downloaderOptions = configureDownloaderOptions(downloaderOptions);
    var downloader = new engine.ArtifactEngine();
    await downloader.processItems(webProvider, localFileProvider, downloaderOptions);
}

async function getArtifactsFromAzureRMStorage(localPathRoot, containerName, commonVirtualPath) {
    console.log(tl.loc('Downloading Artifacts from Azure blob storage, Container Name: ', containerName));

    var connectedService: string = tl.getInput("ConnectedServiceNameARM");
    var subscriptionId: string = tl.getEndpointDataParameter(connectedService, "subscriptionId", false);
    var storageAccountName: string = tl.getInput("storageAccountName");

    var credentials = getARMCredentials(connectedService);
    var storageArmClient = new armStorage.StorageManagementClient(credentials, subscriptionId);
    let storageAccount: armStorage.StorageAccountInfo = await storageArmClient.storageAccounts._getStorageAccountDetails(storageAccountName, credentials, subscriptionId);

    let blobService = new BlobService.BlobService(storageAccount.name, storageAccount.primaryAccessKey);

    blobService.downloadBlobs(localPathRoot, containerName, commonVirtualPath, null, tl.getInput('itemPattern', false) || "**");
}

function configureDownloaderOptions(downloaderOptions: engine.ArtifactEngineOptions): engine.ArtifactEngineOptions {
    downloaderOptions.itemPattern = tl.getInput('itemPattern', false) || "**";
    downloaderOptions.parallelProcessingLimit = +tl.getVariable("release.artifact.download.parallellimit") || 4;
    var debugMode = tl.getVariable('System.Debug');
    downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;

    return downloaderOptions;
}

function getARMCredentials(connectedService: string): msRestAzure.ApplicationTokenCredentials {
    var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
    var servicePrincipalKey: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
    var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
    var armUrl: string = tl.getEndpointUrl(connectedService, true);
    var envAuthorityUrl: string = tl.getEndpointDataParameter(connectedService, 'environmentAuthorityUrl', true);
    envAuthorityUrl = (envAuthorityUrl != null) ? envAuthorityUrl : "https://login.windows.net/";
    var activeDirectoryResourceId: string = tl.getEndpointDataParameter(connectedService, 'activeDirectoryServiceEndpointResourceId', false);
    activeDirectoryResourceId = (activeDirectoryResourceId != null) ? activeDirectoryResourceId : armUrl;
    var credentials = new msRestAzure.ApplicationTokenCredentials(servicePrincipalId, tenantId, servicePrincipalKey, armUrl, envAuthorityUrl, activeDirectoryResourceId, false);
    return credentials;
}

async function doWork() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const serverEndpoint: string = tl.getInput('serverEndpoint', true);
        const serverEndpointUrl: string = tl.getEndpointUrl(serverEndpoint, false);

        const serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(serverEndpoint, false);
        const username: string = serverEndpointAuth['parameters']['username'];
        const password: string = serverEndpointAuth['parameters']['password'];
        const cred: Credential = (username && password) ? new Credential(username, password) : new Credential('', '');

        const jobName: string = tl.getInput('jobName', true);
        const localPathRoot: string = tl.getPathInput('saveTo', true);
        const itemPattern: string = tl.getInput('itemPattern', false) || "**";

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

        if (tl.getBoolInput("propagatedArtifacts") == true) {
            var containerName: string = tl.getInput("containerName");
            var commonVirtualPath: string = tl.getInput("commonVirtualPath");
            getArtifactsFromAzureRMStorage(localPathRoot, containerName, commonVirtualPath);
        } else {
            const artifactQueryUrl: string = `${serverEndpointUrl}/job/${jobName}/${buildId}/api/json?tree=artifacts[*]`;
            var variables = {
                "endpoint": {
                    "url": serverEndpointUrl
                },
                "definition": jobName,
                "version": buildId
            };
            var handler = new handlers.BasicCredentialHandler(username, password);

            getArtifactsFromUrl(artifactQueryUrl, strictSSL, localPathRoot, itemPattern, handler, variables);
        }

        console.log(tl.loc('ArtifactSuccessfullyDownloaded', localPathRoot));

        let downloadCommitsAndWorkItems: boolean = tl.getBoolInput("downloadCommitsAndWorkItems", false);
        if (downloadCommitsAndWorkItems) {
            new ArtifactDetailsDownloader()
            .DownloadCommitsAndWorkItems()
            .then(
                () => console.log(tl.loc("SuccessfullyDownloadedCommitsAndWorkItems")),
                (error) => tl.warning(tl.loc("CommitsAndWorkItemsDownloadFailed", error)));
        }

    } catch (err) {
        tl.debug(err.message);
        tl._writeError(err);
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

doWork();
