var path = require('path');
var url = require('url');
var fs = require('fs');

import * as tl from 'vsts-task-lib/task';
import { IBuildApi } from './vso-node-api/BuildApi';
import { IRequestHandler } from './vso-node-api/interfaces/common/VsoBaseInterfaces';
import { WebApi, getHandlerFromToken } from './vso-node-api/WebApi';
import { BuildStatus, BuildResult, BuildQueryOrder, Build, BuildDefinitionReference } from './vso-node-api/interfaces/BuildInterfaces';

import * as models from 'artifact-engine/Models';
import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';
import * as webHandlers from 'artifact-engine/Providers/typed-rest-client/Handlers';

var taskJson = require('./task.json');

tl.setResourcePath(path.join(__dirname, 'task.json'));

const area: string = 'DownloadBuildArtifacts';

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
        var buildType: string = tl.getInput("buildType", true);
        var isCurrentBuild: boolean = buildType.toLowerCase() === 'current';
        var isSpecificBuildWithTriggering: boolean = tl.getBoolInput("specificBuildWithTriggering", false);
        var projectId: string = null;
        var definitionId: string = null;
        var definitionIdSpecified: string = null;
        var definitionIdTriggered: string = null;
        var buildId: number = null;
        var buildVersionToDownload: string = tl.getInput("buildVersionToDownload", false);
        var allowPartiallySucceededBuilds: boolean = tl.getBoolInput("allowPartiallySucceededBuilds", false);
        var branchName: string =  tl.getInput("branchName", false);;
        var downloadPath: string = tl.getInput("downloadPath", true);
        var downloadType: string = tl.getInput("downloadType", true);
        var tagFiltersInput: string = tl.getInput("tags", false);
        var tagFilters = [];
        if (!!tagFiltersInput) {
            tagFilters = tagFiltersInput.split(",");
        }

        var endpointUrl: string = tl.getVariable("System.TeamFoundationCollectionUri");
        var accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
        var credentialHandler: IRequestHandler = getHandlerFromToken(accessToken);
        var webApi: WebApi = new WebApi(endpointUrl, credentialHandler);
        var debugMode: string = tl.getVariable('System.Debug');
        var isVerbose: boolean = debugMode ? debugMode.toLowerCase() != 'false' : false;
        var parallelLimit: number = +tl.getInput("parallelizationLimit", false);
        var retryLimit = parseInt(tl.getVariable("VSTS_HTTP_RETRY")) ? parseInt(tl.getVariable("VSTS_HTTP_RETRY")) : 4;

        var templatePath: string = path.join(__dirname, 'vsts.handlebars.txt');
        var buildApi: IBuildApi = webApi.getBuildApi();
        var artifacts = [];
        var itemPattern: string = tl.getInput("itemPattern", false) || '**';

        if (isCurrentBuild) {
            projectId = tl.getVariable("System.TeamProjectId");
            definitionId = '';
            buildId = parseInt(tl.getVariable("Build.BuildId"));
        }
        else {
            var releaseAlias: string = tl.getVariable("release.triggeringartifact.alias");
            var triggeringBuildFound: boolean = false;
            definitionIdSpecified = tl.getInput("definition", true);
            if (isSpecificBuildWithTriggering) {
                let hostType = tl.getVariable('system.hostType');
                if ((hostType && hostType.toUpperCase() != 'BUILD')) {
                    // try to use alias to grab triggering artifact for release, starting with definition to verify parity with specified definition
                    definitionIdTriggered = tl.getVariable("release.artifacts." + releaseAlias + ".definitionId");
                    if (definitionIdTriggered == definitionIdSpecified) {
                        // populate values using the triggering build
                        projectId = tl.getVariable("release.artifacts." + releaseAlias + ".projectId");
                        definitionId = definitionIdTriggered;
                        buildId = parseInt(tl.getVariable("release.artifacts." + releaseAlias + ".buildId"));

                        // verify that the triggerring bruild's info was found
                        if (projectId && definitionId && buildId) {
                            triggeringBuildFound = true;
                        }
                    }
                }
                else {
                    //Verify that the triggering build's definition is the same as the specified definition
                    definitionIdTriggered = tl.getVariable("build.triggeredBy.definitionId");
                    if (definitionIdTriggered == definitionIdSpecified) {
                        // populate values using the triggering build
                        projectId = tl.getVariable("build.triggeredBy.projectId");
                        definitionId = definitionIdTriggered;
                        buildId = parseInt(tl.getVariable("build.triggeredBy.buildId"));

                        // verify that the triggerring bruild's info was found
                        if (projectId && definitionId && buildId) {
                            triggeringBuildFound = true;
                        }
                    }
                }
            }

            if (!triggeringBuildFound) {
                // Triggering build info not found, or requested, default to specified build info
                projectId = tl.getInput("project", true);
                definitionId = definitionIdSpecified;
                buildId = parseInt(tl.getInput("buildId", buildVersionToDownload == "specific"));
            }
            
            // if the definition name includes a variable then definitionIdSpecified is a name vs a number
            if (!!definitionIdSpecified && Number.isNaN(parseInt(definitionIdSpecified))) {
                var definitions: BuildDefinitionReference[] = await executeWithRetries("getBuildDefinitions", () => buildApi.getDefinitions(projectId, definitionIdSpecified), retryLimit).catch((reason) => {
                    reject(reason);
                    return;
                });

                if (!definitions || definitions.length < 1) {
                    reject(tl.loc("InvalidBuildDefinitionName", definitionIdSpecified));
                    return;
                }

                definitionId = String(definitions[0].id);
                console.log(tl.loc("DefinitionNameMatchFound", definitionIdSpecified, definitionId));
            }

            if (!definitionId) {
                reject(tl.loc("UnresolvedDefinitionId"));
                return;
            }
        }

        // verify that buildId belongs to the definition selected
        if (definitionId) {
            var build: Build;
            if (buildVersionToDownload != "specific" && !triggeringBuildFound) {
                var resultFilter = BuildResult.Succeeded;
                if (allowPartiallySucceededBuilds) {
                    resultFilter |= BuildResult.PartiallySucceeded;
                }
                var branchNameFilter = (buildVersionToDownload == "latest") ? null : branchName;

                // get latest successful build filtered by branch
                var buildsForThisDefinition = await executeWithRetries("getBuildId", () => buildApi.getBuilds(projectId, [parseInt(definitionId)], null, null, null, null, null, null, BuildStatus.Completed, resultFilter, tagFilters, null, null, null, null, null, BuildQueryOrder.FinishTimeDescending, branchNameFilter), retryLimit).catch((reason) => {
                    reject(reason);
                    return;
                });

                if (!buildsForThisDefinition || buildsForThisDefinition.length == 0) {
                    if (buildVersionToDownload == "latestFromBranch") reject(tl.loc("LatestBuildFromBranchNotFound", branchNameFilter));
                    else reject(tl.loc("LatestBuildNotFound"));
                    return;
                }

                build = buildsForThisDefinition[0];
                console.log(tl.loc("LatestBuildFound", build.id));
                buildId = build.id
            }

            if (!build) {
                build = await executeWithRetries("getBuild", () => buildApi.getBuild(buildId, projectId), retryLimit).catch((reason) => {
                    reject(reason);
                    return;
                });
            }

            if (build) {
                if (!build.definition || build.definition.id !== parseInt(definitionId)) {
                    reject(tl.loc("BuildIdBuildDefinitionMismatch", buildId, definitionId));
                    return;
                }
            }
            else {
                reject(tl.loc("BuildNotFound", buildId));
                return;
            }
        }

        console.log(tl.loc("DownloadingArtifactsForBuild", buildId));

        // populate output variable 'BuildNumber' with buildId
        tl.setVariable('BuildNumber', buildId.toString());

        // populate itempattern and artifacts based on downloadType
        if (downloadType === 'single') {
            var artifactName = tl.getInput("artifactName", true);
            var artifact = await executeWithRetries("getArtifact", () => buildApi.getArtifact(buildId, artifactName, projectId), retryLimit).catch((reason) => {
                reject(reason);
                return;
            });

            if (!artifact) {
                reject(tl.loc("BuildArtifactNotFound", artifactName, buildId));
                return;
            }

            artifacts.push(artifact);
        }
        else {
            var buildArtifacts = await executeWithRetries("getArtifacts", () => buildApi.getArtifacts(buildId, projectId), retryLimit).catch((reason) => {
                reject(reason);
            });

            if (!buildArtifacts) {
                tl.warning(tl.loc("NoArtifactsFound", buildId));
                resolve();
                return;
            }

            console.log(tl.loc("LinkedArtifactCount", buildArtifacts.length));
            artifacts = artifacts.concat(buildArtifacts);
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

                    console.log(tl.loc("DownloadingContainerResource", artifact.resource.data));
                    var containerParts = artifact.resource.data.split('/');

                    if (containerParts.length < 3) {
                        throw new Error(tl.loc("FileContainerInvalidArtifactData"));
                    }
                    
                    var containerId = parseInt(containerParts[1]);
                    var containerPath = containerParts.slice(2,containerParts.length).join('/');

                    if (containerPath == "/") {
                        //container REST api oddity. Passing '/' as itemPath downloads the first file instead of returning the meta data about the all the files in the root level. 
                        //This happens only if the first item is a file.
                        containerPath = ""
                    }

                    var itemsUrl = endpointUrl + "/_apis/resources/Containers/" + containerId + "?itemPath=" + encodeURIComponent(containerPath) + "&isShallow=true&api-version=4.1-preview.4";
                    console.log(tl.loc("DownloadArtifacts", artifact.name, itemsUrl));

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
                    let downloadUrl = artifact.resource.data;
                    let artifactName = artifact.name.replace('/', '\\');
                    let artifactLocation = path.join(downloadUrl, artifactName);
                    if (!fs.existsSync(artifactLocation)) {
                        console.log(tl.loc("ArtifactNameDirectoryNotFound", artifactLocation, downloadUrl));
                        artifactLocation = downloadUrl;
                    }

                    console.log(tl.loc("DownloadArtifacts", artifact.name, artifactLocation));
                    var fileShareProvider = new providers.FilesystemProvider(artifactLocation, artifactName);
                    var fileSystemProvider = new providers.FilesystemProvider(downloadPath);

                    downloadPromises.push(downloader.processItems(fileShareProvider, fileSystemProvider, downloaderOptions).catch((reason) => {
                        reject(reason);
                    }));
                }
                else {
                    console.log(tl.loc("UnsupportedArtifactType", artifact.resource.type));
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

function executeWithRetries(operationName: string, operation: () => Promise<any>, retryCount): Promise<any> {
    var executePromise = new Promise((resolve, reject) => {
        executeWithRetriesImplementation(operationName, operation, retryCount, resolve, reject);
    });

    return executePromise;
}

function executeWithRetriesImplementation(operationName: string, operation: () => Promise<any>, currentRetryCount, resolve, reject) {
    operation().then((result) => {
        resolve(result);
    }).catch((error) => {
        if (currentRetryCount <= 0) {
            tl.error(tl.loc("OperationFailed", operationName, error));
            reject(error);
        }
        else {
            console.log(tl.loc('RetryingOperation', operationName, currentRetryCount));
            currentRetryCount = currentRetryCount - 1;
            setTimeout(() => executeWithRetriesImplementation(operationName, operation, currentRetryCount, resolve, reject), 4 * 1000);
        }
    });
}

main()
    .then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((err) => {
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });
