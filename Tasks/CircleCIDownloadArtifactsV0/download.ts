import { resolve } from 'vsts-task-lib/mock-task';
var path = require('path')
var url = require('url')

import * as tl from 'vsts-task-lib/task';
import * as models from 'artifact-engine/Models';
import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';
import * as webHandlers from 'artifact-engine/Providers/typed-rest-client/Handlers';

import {CommitsDownloader} from "./commitsdownloader"

tl.setResourcePath(path.join(__dirname, 'task.json'));

var taskJson = require('./task.json');
const area: string = 'DownloadCircleCIArtifacts';

function getDefaultProps() {
    var hostType = (tl.getVariable('SYSTEM.HOSTTYPE') || "").toLowerCase();
    return {
        hostType: hostType,
        definitionName: '[NonEmail:' + (hostType === 'release' ? tl.getVariable('RELEASE.DEFINITIONNAME') : tl.getVariable('BUILD.DEFINITIONNAME')) + ']',
        processId: hostType === 'release' ? tl.getVariable('RELEASE.RELEASEID') : tl.getVariable('BUILD.BUILDID'),
        processUrl: hostType === 'release' ? tl.getVariable('RELEASE.RELEASEWEBURL') : (tl.getVariable('SYSTEM.TEAMFOUNDATIONSERVERURI') + tl.getVariable('SYSTEM.TEAMPROJECT') + '/_build?buildId=' + tl.getVariable('BUILD.BUILDID')),
        taskDisplayName: tl.getVariable('TASK.DISPLAYNAME'),
        jobid: tl.getVariable('SYSTEM.JOBID'),
        agentVersion: tl.getVariable('AGENT.VERSION'),
        agentOS: tl.getVariable('AGENT.OS'),
        agentName: tl.getVariable('AGENT.NAME'),
        version: taskJson.version
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
                telemetry = "##vso[task.logissue type=error;code=" + reliabilityData.issueType + ";agentVersion=" + tl.getVariable('Agent.Version') + ";taskId=" + area + "-" + JSON.stringify(taskJson.version) + ";]" + reliabilityData.errorMessage
            }
        }
        console.log(telemetry);;
    }
    catch (err) {
        tl.warning("Failed to log telemetry, error: " + err);
    }
}

async function main(): Promise<void> {
    var promise = new Promise<void>(async (resolve, reject) => {
        let connection = tl.getInput("connection", true);
        let definitionId = tl.getInput("definition", true);
        let buildId = tl.getInput("version", true);
        let itemPattern = tl.getInput("itemPattern", false);
        let downloadPath = tl.getInput("downloadPath", true);

        var endpointUrl = tl.getEndpointUrl(connection, false);
        var itemsUrl = `${endpointUrl}/api/v1.1/project/${definitionId}/${buildId}/artifacts`;
        itemsUrl = itemsUrl.replace(/([^:]\/)\/+/g, "$1");
        console.log(tl.loc("DownloadArtifacts", itemsUrl));

        var templatePath = path.join(__dirname, 'circleCI.handlebars.txt');
        var username = tl.getEndpointAuthorizationParameter(connection, 'username', false);
        var circleciVariables = {
            "endpoint": {
                "url": endpointUrl
            }
        };
        var handler = new webHandlers.BasicCredentialHandler(username, "");
        var webProvider = new providers.WebProvider(itemsUrl, templatePath, circleciVariables, handler);
        var fileSystemProvider = new providers.FilesystemProvider(downloadPath);
        var parallelLimit : number = +tl.getVariable("release.artifact.download.parallellimit");

        var downloader = new engine.ArtifactEngine();
        var downloaderOptions = new engine.ArtifactEngineOptions();
        downloaderOptions.itemPattern = itemPattern ? itemPattern : '**';
        var debugMode = tl.getVariable('System.Debug');
        downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;
        var parallelLimit : number = +tl.getVariable("release.artifact.download.parallellimit");
        
        if(parallelLimit){
            downloaderOptions.parallelProcessingLimit = parallelLimit;
        }

        await downloader.processItems(webProvider, fileSystemProvider, downloaderOptions).then((result) => {
            console.log(tl.loc('ArtifactsSuccessfullyDownloaded', downloadPath));
            resolve();
        }).catch((error) => {
            reject(error);
        });
        
        let downloadCommitsFlag: boolean = tl.getBoolInput("downloadCommitsAndWorkItems", true);
        if (downloadCommitsFlag) {
            var webProviderForDownloaingCommits = new providers.WebProvider(itemsUrl, templatePath, circleciVariables, handler);
            downloadCommits(webProviderForDownloaingCommits);
        }
    });

    return promise;
}

function downloadCommits(webProvider: providers.WebProvider): void {
    let circleCIBuild = tl.getInput("version", true);
    let startBuildIdStr = tl.getInput("previousVersion", false) || "";

    if (startBuildIdStr && parseInt(circleCIBuild) > parseInt(startBuildIdStr)) {
        new CommitsDownloader(webProvider).DownloadFromBuildRangeAndSave(startBuildIdStr, circleCIBuild);
    } else {
        new CommitsDownloader(webProvider).DownloadFromSingleBuildAndSave(circleCIBuild);
    }
}

main()
    .then((result) => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    })
    .catch((err) => {
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });