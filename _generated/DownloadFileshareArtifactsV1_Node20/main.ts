var path = require('path');
var url = require('url');
var fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';

import * as models from 'artifact-engine/Models';
import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';
import * as webHandlers from 'artifact-engine/Providers/typed-rest-client/Handlers';

var taskJson = require('./task.json');

tl.setResourcePath(path.join(__dirname, 'task.json'));

const area: string = 'DownloadFileShareArtifacts';

function getDefaultProps() {
    const hostType = (tl.getVariable('SYSTEM.HOSTTYPE') || "").toLowerCase();
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
    const promise = new Promise<void>(async (resolve, reject) => {
        const downloadPath: string = tl.getInput("downloadPath", true);
        const debugMode: string = tl.getVariable('System.Debug');
        const isVerbose: boolean = debugMode ? debugMode.toLowerCase() != 'false' : false;
        const parallelLimit: number = +tl.getInput("parallelizationLimit", false);
        const retryLimit = parseInt(tl.getVariable("VSTS_HTTP_RETRY")) ? parseInt(tl.getVariable("VSTS_HTTP_RETRY")) : 4;
        const itemPattern: string = tl.getInput("itemPattern", false) || '**';

        const downloader = new engine.ArtifactEngine();
        const downloadUrl = tl.getInput("filesharePath", true);
        let artifactName = tl.getInput("artifactName", true);
        artifactName = artifactName.replace('/', '\\');
        let artifactLocation = path.join(downloadUrl, artifactName);

        console.log(tl.loc("DownloadArtifacts", artifactName, artifactLocation));
        if (!fs.existsSync(artifactLocation)) {
            console.log(tl.loc("ArtifactNameDirectoryNotFound", artifactLocation, downloadUrl));
            artifactLocation = downloadUrl;
        }

        let downloaderOptions = new engine.ArtifactEngineOptions();
        downloaderOptions.itemPattern = itemPattern;
        downloaderOptions.verbose = isVerbose;

        if (parallelLimit) {
            downloaderOptions.parallelProcessingLimit = parallelLimit;
        }

        let fileShareProvider = new providers.FilesystemProvider(artifactLocation, artifactName);
        let fileSystemProvider = new providers.FilesystemProvider(downloadPath);

        let downloadPromise = downloader.processItems(fileShareProvider, fileSystemProvider, downloaderOptions);

        downloadPromise.then(() => {
            console.log(tl.loc('ArtifactsSuccessfullyDownloaded', downloadPath));
            resolve();
        }).catch((error) => {
            reject(error);
        });
    });
    
    return promise;
}

main()
    .then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((err) => {
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });
