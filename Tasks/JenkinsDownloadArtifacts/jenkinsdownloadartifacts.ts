// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');
import request = require('request');

import * as handlers from "artifact-engine/Providers/Handlers"
import * as providers from "artifact-engine/Providers"
import * as engine from "artifact-engine/Engine"

import { ArtifactDetailsDownloader } from "./ArtifactDetails/ArtifactDetailsDownloader";
import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { JenkinsRestClient, JenkinsJobDetails } from "./ArtifactDetails/JenkinsRestClient"

async function getArtifactsFromUrl(artifactQueryUrl: string, strictSSL: boolean, localPathRoot: string, itemPattern: string, handler: handlers.BasicCredentialHandler, variables: { [key: string]: any }) {
    console.log(tl.loc('ArtifactDownloadUrl', artifactQueryUrl));

    var templatePath = path.join(__dirname, 'jenkins.handlebars.txt');
    var webProvider = new providers.WebProvider(artifactQueryUrl, templatePath, variables, handler, { ignoreSslError: !strictSSL });
    var localFileProvider = new providers.FilesystemProvider(localPathRoot);

    var downloaderOptions = configureDownloaderOptions();
    var downloader = new engine.ArtifactEngine();
    await downloader.processItems(webProvider, localFileProvider, downloaderOptions);
}

function configureDownloaderOptions(): engine.ArtifactEngineOptions {
    var downloaderOptions = new engine.ArtifactEngineOptions();
    downloaderOptions.itemPattern = tl.getInput('itemPattern', false) || "**";
    downloaderOptions.parallelProcessingLimit = +tl.getVariable("release.artifact.download.parallellimit") || 4;
    var debugMode = tl.getVariable('System.Debug');
    downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;

    return downloaderOptions;
}

async function doWork() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const serverEndpoint: string = tl.getInput('serverEndpoint', true);
        const serverEndpointUrl: string = tl.getEndpointUrl(serverEndpoint, false);

        const serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(serverEndpoint, false);
        const username: string = serverEndpointAuth['parameters']['username'];
        const password: string = serverEndpointAuth['parameters']['password'];

        const jobName: string = tl.getInput('jobName', true);
        const localPathRoot: string = tl.getPathInput('saveTo', true);
        const itemPattern: string = tl.getInput('itemPattern', false) || "**";
        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(serverEndpoint, 'acceptUntrustedCerts', true));

        let jenkinsClient: JenkinsRestClient = new JenkinsRestClient();
        let jenkinsJobDetails: JenkinsJobDetails = await jenkinsClient.GetJobDetails();
        console.log(tl.loc("FoundJenkinsJobDetails", jenkinsJobDetails.jobName, jenkinsJobDetails.jobType, jenkinsJobDetails.buildId, jenkinsJobDetails.multiBranchPipelineName));

        if (tl.getBoolInput('propagatedArtifacts') == true) {
            var artifactProvider = tl.getInput('artifactProvider');
            switch (artifactProvider.toLowerCase()) {
                case "azurestorage":
                    new AzureStorageArtifactDownloader().downloadArtifacts(localPathRoot);
                    break;

                default:
                    throw Error(tl.loc('ArtifactProviderNotSupported', artifactProvider));
            }
        }
        else {
            const artifactQueryUrl: string = `${serverEndpointUrl}/job/${jobName}${jenkinsJobDetails.multiBranchPipelineUrlInfix}/${jenkinsJobDetails.buildId}/api/json?tree=artifacts[*]`;
            var variables = {
                "endpoint": {
                    "url": serverEndpointUrl
                },
                "definition": jobName,
                "multibranchPipelineUrlInfix": jenkinsJobDetails.multiBranchPipelineUrlInfix,
                "version": jenkinsJobDetails.buildId
            };

            var handler = new handlers.BasicCredentialHandler(username, password);
            getArtifactsFromUrl(artifactQueryUrl, strictSSL, localPathRoot, itemPattern, handler, variables);
        }

        console.log(tl.loc('ArtifactSuccessfullyDownloaded', localPathRoot));

        let downloadCommitsAndWorkItems: boolean = tl.getBoolInput("downloadCommitsAndWorkItems", false);
        if (downloadCommitsAndWorkItems) {
            new ArtifactDetailsDownloader()
                .DownloadCommitsAndWorkItems(jenkinsJobDetails)
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
