var path = require('path')

import * as tl from 'vsts-task-lib/task';
import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';
import * as httpc from 'typed-rest-client/HttpClient';

var packagejson = require('./package.json');

tl.setResourcePath(path.join(__dirname, 'task.json'));

var taskJson = require('./task.json');
const area: string = 'DownloadGitHubRelease';
const userAgent: string = 'download-github-release-task-' + packagejson.version;
const defaultRetryLimit: number = 4;

interface Release {
    Id: number;
    Name: string;
}

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

function publishTelemetry(feature, properties: any): void {
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

async function getLatestRelease(repositoryName: string, handler): Promise<Release> {
    var promise = new Promise<Release>((resolve, reject) => {
        let httpClient: httpc.HttpClient = new httpc.HttpClient(userAgent, [handler]);
        let latestReleaseUrl = "https://api.github.com/repos/" + repositoryName + "/releases/latest";
        latestReleaseUrl = latestReleaseUrl.replace(/([^:]\/)\/+/g, "$1");
        httpClient.get(latestReleaseUrl).then((res) => {
            res.readBody().then((body) => {
                let response = JSON.parse(body);
                let release: Release = {
                    Id: response["id"],
                    Name: response["tag_name"]
                }
                resolve(release);
            });
        }, (reason) => {
            reject(reason);
        });
    });

    return promise;
}

async function getTaggedRelease(repositoryName: string, tag: string, handler): Promise<Release> {
    var promise = new Promise<Release>((resolve, reject) => {
        let httpClient: httpc.HttpClient = new httpc.HttpClient(userAgent, [handler]);
        let taggedReleaseUrl = "https://api.github.com/repos/" + repositoryName + "/releases/tags/" + tag;
        taggedReleaseUrl = taggedReleaseUrl.replace(/([^:]\/)\/+/g, "$1");
        httpClient.get(taggedReleaseUrl).then((res) => {
            res.readBody().then((body) => {
                let response = JSON.parse(body);
                let release: Release = {
                    Id: response["id"],
                    Name: response["tag_name"]
                }
                resolve(release);
            });
        }, (reason) => {
            reject(reason);
        });
    });

    return promise;
}

async function getSpecificRelease(repositoryName: string, version: string, handler): Promise<Release> {
    var promise = new Promise<Release>((resolve, reject) => {
        let httpClient: httpc.HttpClient = new httpc.HttpClient(userAgent, [handler]);
        let taggedReleaseUrl = "https://api.github.com/repos/" + repositoryName + "/releases/" + version;
        taggedReleaseUrl = taggedReleaseUrl.replace(/([^:]\/)\/+/g, "$1");
        httpClient.get(taggedReleaseUrl).then((res) => {
            res.readBody().then((body) => {
                let response = JSON.parse(body);
                let release: Release = {
                    Id: response["id"],
                    Name: !!(response["name"]) ? response["name"] : response["tag_name"]
                }
                resolve(release);
            });
        }, (reason) => {
            reject(reason);
        });
    });

    return promise;
}

async function main(): Promise<void> {
    var promise = new Promise<void>(async (resolve, reject) => {
        let connection = tl.getInput("connection", true);
        let repositoryName = tl.getInput("userRepository", true);
        let defaultVersionType = tl.getInput("defaultVersionType", true);
        let itemPattern = tl.getInput("itemPattern", false);
        let downloadPath = tl.getInput("downloadPath", true);
        let version = tl.getInput("version", false);
        let release: Release = null;

        if (!defaultVersionType) {
            defaultVersionType = "latest";
        }

        var token = tl.getEndpointAuthorizationParameter(connection, 'AccessToken', false);
        var retryLimit = parseInt(tl.getVariable("VSTS_HTTP_RETRY")) ? parseInt(tl.getVariable("VSTS_HTTP_RETRY")) : defaultRetryLimit;

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
                        let updatedHeaders = {};
                        for (var key in options.headers) {
                            if (key.toLowerCase() != "authorization") {
                                updatedHeaders[key] = options.headers[key];
                            }
                        }

                        options.headers = updatedHeaders;
                    }
                }
            }
        }

        if (defaultVersionType.toLowerCase() == 'specificversion') {
            release = await executeWithRetries("getSpecificRelease", () => getSpecificRelease(repositoryName, version, customCredentialHandler), retryLimit).catch((reason) => { reject(reason); });
        }
        else if (defaultVersionType.toLowerCase() == 'specifictag') {
            release = await executeWithRetries("getTaggedRelease", () => getTaggedRelease(repositoryName, version, customCredentialHandler), retryLimit).catch((reason) => { reject(reason); });
        }
        else {
            if (!!version) {
                release = await executeWithRetries("getTaggedRelease", () => getTaggedRelease(repositoryName, version, customCredentialHandler), retryLimit).catch((reason) => { reject(reason); });
            }
            else {
                release = await executeWithRetries("getLatestRelease", () => getLatestRelease(repositoryName, customCredentialHandler), retryLimit).catch((reason) => { reject(reason); });
            }
        }

        if (!release || !release.Id) {
            reject(tl.loc("InvalidRelease", version));
            return;
        }

        var itemsUrl = "https://api.github.com/repos/" + repositoryName + "/releases/" + release.Id + "/assets";
        itemsUrl = itemsUrl.replace(/([^:]\/)\/+/g, "$1");
        
        console.log(tl.loc("DownloadArtifacts", release.Name, itemsUrl));

        var templatePath = path.join(__dirname, 'githubrelease.handlebars.txt');
        var gitHubReleaseVariables = {
            "endpoint": {
                "url": "https://api.github.com/"
            }
        };

        var webProvider = new providers.WebProvider(itemsUrl, templatePath, gitHubReleaseVariables, customCredentialHandler);
        var fileSystemProvider = new providers.FilesystemProvider(downloadPath);
        var parallelLimit: number = +tl.getVariable("release.artifact.download.parallellimit");

        var downloader = new engine.ArtifactEngine();
        var downloaderOptions = new engine.ArtifactEngineOptions();
        downloaderOptions.itemPattern = itemPattern ? itemPattern : '**';
        var debugMode = tl.getVariable('System.Debug');
        downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;

        if (parallelLimit) {
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
    .then((result) => {
        tl.setResult(tl.TaskResult.Succeeded, "");
    })
    .catch((err) => {
        publishTelemetry('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });