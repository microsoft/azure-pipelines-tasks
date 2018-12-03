var path = require('path')

import * as tl from 'vsts-task-lib/task';
import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';

tl.setResourcePath(path.join(__dirname, 'task.json'));

var taskJson = require('./task.json');
const area: string = 'DownloadGithubReleases';

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
        let repositoryName = tl.getInput("definition", true);
        let releaseId = tl.getInput("versions", true);
        let itemPattern = tl.getInput("itemPattern", false);
        let downloadPath = tl.getInput("downloadPath", true);

        var itemsUrl = "https://api.github.com/repos/" + repositoryName + "/releases/" + releaseId + "/assets";
        itemsUrl = itemsUrl.replace(/([^:]\/)\/+/g, "$1");
        console.log(tl.loc("DownloadArtifacts", releaseId, itemsUrl));
        
        var templatePath = path.join(__dirname, 'githubreleases.handlebars.txt');
        var token = tl.getEndpointAuthorizationParameter(connection, 'AccessToken', false);
        var githubReleasesVariables = {
            "endpoint": {
                "url": "https://api.github.com/"
            }
        };

        // Required to prevent typed-rest-client from adding additional 'Authorization' in header on redirect to AWS
        var customCredentialHandler = {
            canHandleAuthentication: () => false,
            handleAuthentication: () => { },
            prepareRequest: (options) => {
                if (options.host.indexOf("amazonaws") == -1) {
                    options.headers['Authorization'] = 'Bearer ' + token;
                }
                else {
                    if (!!options.headers['Authorization']) {
                        var b = {}
                        for (var key in options.headers) {
                            if (key != "Authorization") {
                                b[key] = options.headers[key]
                            }
                        }

                        options.headers = b
                    }
                }
            }
        }

        var webProvider = new providers.WebProvider(itemsUrl, templatePath, githubReleasesVariables, customCredentialHandler);
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
    });

    return promise;
}

main()
    .then((result) => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    })
    .catch((err) => {
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });