var path = require('path')
var url = require('url')

import * as tl from 'vsts-task-lib/task';
import { IBuildApi } from 'vso-node-api/BuildApi';
import { IRequestHandler } from 'vso-node-api/interfaces/common/VsoBaseInterfaces';
import { WebApi, getHandlerFromToken } from 'vso-node-api/WebApi';

import * as models from 'artifact-engine/Models';
import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';
import * as webHandlers from 'artifact-engine/Providers/Handlers';

var packagejson = require('./package.json');

tl.setResourcePath(path.join(__dirname, 'task.json'));

const area: string = 'DownloadBuildArtifacts';

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

async function main(): Promise<void> {
    var promise = new Promise<void>(async (resolve, reject) => {
        var buildType: string = tl.getInput("buildType", true);
        var isCurrentBuild: boolean = buildType.toLowerCase() === 'current';
        var projectId: string = isCurrentBuild ? tl.getVariable("System.TeamProjectId") : tl.getInput("project", true);
        var definitionId: string = isCurrentBuild ? '' : tl.getInput("definition", true);
        var buildId: number = parseInt(isCurrentBuild ? tl.getVariable("Build.BuildId") : tl.getInput("buildId", true));
        var downloadPath: string = tl.getInput("downloadPath", true);
        var downloadType: string = tl.getInput("downloadType", true);

        var endpointUrl: string = tl.getVariable("System.TeamFoundationCollectionUri");
        var accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
        var credentialHandler: IRequestHandler = getHandlerFromToken(accessToken);
        var webApi: WebApi = new WebApi(endpointUrl, credentialHandler);
        var debugMode: string = tl.getVariable('System.Debug');
        var isVerbose: boolean = debugMode ? debugMode.toLowerCase() != 'false' : false;
        var parallelLimit: number = +tl.getInput("parallelizationLimit", false);

        var templatePath: string = path.join(__dirname, 'vsts.handlebars.txt');
        var buildApi: IBuildApi = webApi.getBuildApi();
        var artifacts = [];
        var itemPattern: string = '**';

        // verify that buildId belongs to the definition selected
        if (definitionId) {
            var build = await buildApi.getBuild(buildId, projectId).catch((reason) => {
                reject(reason);
                return;
            });

            if (build) {
                if (build.definition.id !== parseInt(definitionId)) {
                    reject(tl.loc("BuildIdBuildDefinitionMismatch", buildId, definitionId));
                    return;
                }
            }
            else {
                reject(tl.loc("BuildNotFound", buildId));
                return;
            }
        }

        // populate itempattern and artifacts based on downloadType
        if (downloadType === 'single') {
            var artifactName = tl.getInput("artifactName");
            var artifact = await buildApi.getArtifact(buildId, artifactName, projectId).catch((reason) => {
                reject(reason);
                return;
            });

            if (!artifact) {
                reject(tl.loc("BuildArtifactNotFound", artifactName, buildId));
                return;
            }

            artifacts.push(artifact);
            itemPattern = '**';
        }
        else {
            var buildArtifacts = await buildApi.getArtifacts(buildId, projectId).catch((reason) => {
                reject(reason);
            });

            if (!buildArtifacts) {
                tl.warning(tl.loc("NoArtifactsFound", buildId));
                resolve();
                return;
            }

            console.log(tl.loc("LinkedArtifactCount", buildArtifacts.length));
            artifacts = artifacts.concat(buildArtifacts);
            itemPattern = tl.getInput("itemPattern", false) || '**';
        }

        if (artifacts) {
            var downloadPromises: Array<Promise<any>> = [];
            artifacts.forEach(async function (artifact, index, artifacts) {
                let downloaderOptions = new engine.ArtifactEngineOptions();
                downloaderOptions.itemPattern = itemPattern;
                downloaderOptions.verbose = isVerbose;

                if (parallelLimit) {
                    downloaderOptions.parallelProcessingLimit = parallelLimit;
                }

                if (artifact.resource.type.toLowerCase() === "container") {
                    let downloader = new engine.ArtifactEngine();
                    var containerParts: string[] = artifact.resource.data.split('/', 3);
                    if (containerParts.length !== 3) {
                        throw new Error(tl.loc("FileContainerInvalidArtifactData"));
                    }

                    var containerId: number = parseInt(containerParts[1]);
                    var containerPath: string = containerParts[2];

                    var itemsUrl = endpointUrl + "/_apis/resources/Containers/" + containerId + "?itemPath=" + containerPath + "&isShallow=true&api-version=4.1-preview.4";
                    console.log(tl.loc("DownloadArtifacts", itemsUrl));

                    var variables = {};
                    var handler = new webHandlers.PersonalAccessTokenCredentialHandler(accessToken);
                    var webProvider = new providers.WebProvider(itemsUrl, templatePath, variables, handler);
                    var fileSystemProvider = new providers.FilesystemProvider(downloadPath);

                    downloadPromises.push(downloader.processItems(webProvider, fileSystemProvider, downloaderOptions).catch((reason) => {
                        reject(reason);
                    }));
                }
                else if (artifact.resource.type.toLowerCase() === "filepath") {
                    let downloader = new engine.ArtifactEngine();
                    console.log(tl.loc("DownloadArtifacts", artifact.resource.downloadUrl));
                    var fileShareProvider = new providers.FilesystemProvider(artifact.resource.downloadUrl.replace("file:", ""));
                    var fileSystemProvider = new providers.FilesystemProvider(downloadPath);

                    downloadPromises.push(downloader.processItems(fileShareProvider, fileSystemProvider, downloaderOptions).catch((reason) => {
                        reject(reason);
                    }));
                }
                else {
                    tl.warning(tl.loc("UnsupportedArtifactType", artifact.resource.type));
                }
            });

            Promise.all(downloadPromises).then(() => {
                console.log(tl.loc('ArtifactsSuccessfullyDownloaded', downloadPath));
                resolve();
            }).catch((error) => {
                reject(error);
            });
        }
    });
    return promise;
}

main()
    .then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((err) => {
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });
