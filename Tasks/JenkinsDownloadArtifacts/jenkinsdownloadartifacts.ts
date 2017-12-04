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

import { AzureStorageArtifactDownloader } from "./AzureStorageArtifacts/AzureStorageArtifactDownloader";
import { ArtifactDetailsDownloader } from "./ArtifactDetails/ArtifactDetailsDownloader";
import { JenkinsRestClient, JenkinsJobDetails } from "./ArtifactDetails/JenkinsRestClient"

var packagejson = require('./package.json');

const area: string = 'JenkinsDownloadArtifacts';

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

function getDefaultProps() {
    return {
        serverurl: tl.getVariable('System.TEAMFOUNDATIONSERVERURI'),
        releaseurl: tl.getVariable('Release.ReleaseWebUrl'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid'),
        jobid: tl.getVariable('System.Jobid'),
        agentVersion: tl.getVariable('Agent.Version'),
        version: packagejson.version
    };
}

function publishEvent(feature, properties: any): void {
    try {
        var splitVersion = (process.env.AGENT_VERSION || '').split('.');
        var major = parseInt(splitVersion[0] || '0');
        var minor = parseInt(splitVersion[1] || '0');
        let telemetry = '';
        if (major > 2 || (major == 2 && minor >= 120)) {
            telemetry = `##vso[telemetry.publish area=${area};feature=${feature}]${JSON.stringify(Object.assign(getDefaultProps(), properties))}`;
        }
        else {
            if (feature === 'reliability') {
                let reliabilityData = properties;
                telemetry = "##vso[task.logissue type=error;code=" + reliabilityData.issueType + ";agentVersion=" + tl.getVariable('Agent.Version') + ";taskId=" + area + "-" + packagejson.version + ";]" + reliabilityData.errorMessage
            }
        }
        console.log(telemetry);;
    }
    catch (err) {
        tl.warning("Failed to log telemetry, error: " + err);
    }
}

async function doWork() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const serverEndpoint: string = tl.getInput('serverEndpoint', true);
        const serverEndpointUrl: string = tl.getEndpointUrl(serverEndpoint, false);
        const username: string = tl.getEndpointAuthorizationParameter(serverEndpoint, 'username', false);
        const password: string = tl.getEndpointAuthorizationParameter(serverEndpoint, 'password', false);

        const jobName: string = tl.getInput('jobName', true);
        const localPathRoot: string = tl.getPathInput('saveTo', true);
        const itemPattern: string = tl.getInput('itemPattern', false) || "**";
        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(serverEndpoint, 'acceptUntrustedCerts', true));

        let jenkinsClient: JenkinsRestClient = new JenkinsRestClient();
        let jenkinsJobDetails: JenkinsJobDetails;

        if (tl.getBoolInput('propagatedArtifacts') == true) {
            var artifactProvider = tl.getInput('artifactProvider');
            switch (artifactProvider.toLowerCase()) {
                case "azurestorage":
                    let azureDownloader = new AzureStorageArtifactDownloader(tl.getInput('ConnectedServiceNameARM', true),
                        tl.getInput('storageAccountName', true), 
                        tl.getInput('containerName', true), 
                        tl.getInput('commonVirtualPath', false));
                        await azureDownloader.downloadArtifacts(localPathRoot, tl.getInput('itemPattern', false) || "**");
                    break;
                default:
                    throw Error(tl.loc('ArtifactProviderNotSupported', artifactProvider));
            }
        }
        else {
            jenkinsJobDetails = await jenkinsClient.GetJobDetails();
            console.log(tl.loc("FoundJenkinsJobDetails", jenkinsJobDetails.jobName, jenkinsJobDetails.jobType, jenkinsJobDetails.buildId, jenkinsJobDetails.multiBranchPipelineName));

            const artifactQueryUrl: string = `${serverEndpointUrl}/${jenkinsJobDetails.jobUrlInfix}/${jenkinsJobDetails.multiBranchPipelineUrlInfix}/${jenkinsJobDetails.buildId}/api/json?tree=artifacts[*]`;
            var variables = {
                "endpoint": {
                    "url": serverEndpointUrl
                },
                "jobUrlInfix": jenkinsJobDetails.jobUrlInfix,
                "multibranchPipelineUrlInfix": jenkinsJobDetails.multiBranchPipelineUrlInfix,
                "version": jenkinsJobDetails.buildId
            };

            var handler = new handlers.BasicCredentialHandler(username, password);
            
            await getArtifactsFromUrl(artifactQueryUrl, strictSSL, localPathRoot, itemPattern, handler, variables);
        }

        console.log(tl.loc('ArtifactSuccessfullyDownloaded', localPathRoot));

        let downloadCommitsAndWorkItems: boolean = tl.getBoolInput("downloadCommitsAndWorkItems", false);
        if (downloadCommitsAndWorkItems) {
            if (tl.getBoolInput('propagatedArtifacts') == true) {
                try {
                    jenkinsJobDetails = await jenkinsClient.GetJobDetails();
                    console.log(tl.loc("FoundJenkinsJobDetails", jenkinsJobDetails.jobName, jenkinsJobDetails.jobType, jenkinsJobDetails.buildId, jenkinsJobDetails.multiBranchPipelineName));
                }
                catch (error) {
                    tl.warning(tl.loc("CommitsAndWorkItemsDownloadFailed", error));
                }
            }

            new ArtifactDetailsDownloader()
                .DownloadCommitsAndWorkItems(jenkinsJobDetails)
                .then(() => console.log(tl.loc("SuccessfullyDownloadedCommitsAndWorkItems")),
                (error) => tl.warning(tl.loc("CommitsAndWorkItemsDownloadFailed", error)));
        }

    } catch (err) {
        tl.debug(err.message);
        tl._writeError(err);
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

doWork();