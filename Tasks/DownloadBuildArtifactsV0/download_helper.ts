import * as tl from 'azure-pipelines-task-lib/task';
import * as providers from 'artifact-engine/Providers';
import { ArtifactDownloadTicket, ItemType, TicketState } from 'artifact-engine/Models';
import { ArtifactEngine, ArtifactEngineOptions } from 'artifact-engine/Engine';
import { PersonalAccessTokenCredentialHandler as PATCredentialHandler } from 'artifact-engine/Providers/typed-rest-client/Handlers';

const area: string = 'DownloadBuildArtifacts';
const taskJson = require('./task.json');
const DecompressZip = require('decompress-zip');

/**
 * @param  {} feature
 * @param  {any} properties
 * @returns void
 */
export function publishEvent(feature, properties: any): void {
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
        console.log(telemetry);
    }
    catch (err) {
        tl.warning("Failed to log telemetry, error: " + err);
    }
}

/**
 * @returns engine
 */
export function configureDownloaderOptions(): ArtifactEngineOptions {
    var downloaderOptions = new ArtifactEngineOptions();
    downloaderOptions.itemPattern = tl.getInput('itemPattern', false) || "**";
    downloaderOptions.parallelProcessingLimit = +tl.getVariable("release.artifact.download.parallellimit") || 8;
    var debugMode = tl.getVariable('System.Debug');
    downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;

    return downloaderOptions;
}

/**
 * @param  {string} artifactArchiveUrl
 * @param  {string} downloadPath
 * @param  {string} zipLocation
 * @param  {webHandlers.PersonalAccessTokenCredentialHandler} handler
 * @param  {ArtifactEngineOptions} downloaderOptions
 */
export async function downloadZip(artifactArchiveUrl: string, downloadPath: string, zipLocation: string, handler: PATCredentialHandler, downloaderOptions: ArtifactEngineOptions) {
    var executePromise = new Promise((resolve, reject) => {
        tl.debug("Starting downloadZip action");

        if (tl.exist(zipLocation)) {
            tl.rmRF(zipLocation);
        }

        getZipFromUrl(artifactArchiveUrl, zipLocation, handler, downloaderOptions)
            .then((artifactDownloadTickets) => checkArtifactConsistency(artifactDownloadTickets))
            .then(() => {
                tl.debug("Successfully downloaded from " + artifactArchiveUrl);
                unzip(zipLocation, downloadPath).then(() => {

                    tl.debug("Successfully extracted " + zipLocation);
                    if (tl.exist(zipLocation)) {
                        tl.rmRF(zipLocation);
                    }

                    resolve();

                }).catch((error) => {
                    reject(error);
                });

            })
            .catch((error) => {
                reject(error);
            });
    });

    return executePromise;
}

/**
 * @param  {string} operationName
 * @param  {()=>Promise<any>} operation
 * @param  {} retryCount
 * @returns Promise
 */
export function executeWithRetries(operationName: string, operation: () => Promise<any>, retryCount): Promise<any> {
    var executePromise = new Promise((resolve, reject) => {
        executeWithRetriesImplementation(operationName, operation, retryCount, resolve, reject, retryCount);
    });

    return executePromise;
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

/**
 * @param  {string} zipLocation
 * @param  {string} unzipLocation
 * @returns Promise
 */
function unzip(zipLocation: string, unzipLocation: string): Promise<void> {
    return new Promise<void>(function (resolve, reject) {
        if (!tl.exist(zipLocation)) {
            return resolve();
        }

        tl.debug('Extracting ' + zipLocation + ' to ' + unzipLocation);

        var unzipper = new DecompressZip(zipLocation);
        unzipper.on('error', err => {
            return reject(tl.loc("ExtractionFailed", err))
        });
        unzipper.on('extract', log => {
            tl.debug('Extracted ' + zipLocation + ' to ' + unzipLocation + ' successfully');
            return resolve();
        });
        unzipper.extract({
            path: unzipLocation
        });
    });
}

/**
 * @param  {string} artifactArchiveUrl
 * @param  {string} localPathRoot
 * @param  {webHandlers.PersonalAccessTokenCredentialHandler} handler
 * @param  {ArtifactEngineOptions} downloaderOptions
 * @returns Promise
 */
function getZipFromUrl(artifactArchiveUrl: string, localPathRoot: string, handler: PATCredentialHandler, downloaderOptions: ArtifactEngineOptions): Promise<ArtifactDownloadTicket[]> {
    var downloader = new ArtifactEngine();
    var zipProvider = new providers.ZipProvider(artifactArchiveUrl, handler);
    var filesystemProvider = new providers.FilesystemProvider(localPathRoot);

    tl.debug("Starting download from " + artifactArchiveUrl);
    return downloader.processItems(zipProvider, filesystemProvider, downloaderOptions);
}

/**
 * @param  {string} operationName
 * @param  {()=>Promise<any>} operation
 * @param  {} currentRetryCount
 * @param  {} resolve
 * @param  {} reject
 * @param  {} retryCountLimit
 */
function executeWithRetriesImplementation(operationName: string, operation: () => Promise<any>, currentRetryCount, resolve, reject, retryCountLimit) {
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
            setTimeout(() => executeWithRetriesImplementation(operationName, operation, currentRetryCount, resolve, reject, retryCountLimit), getRetryIntervalInSeconds(retryCountLimit - currentRetryCount) * 1000);
        }
    });
}

/**
 * @param  {number} retryCount
 * @returns number
 */
function getRetryIntervalInSeconds(retryCount: number): number {
    let MaxRetryLimitInSeconds = 360;
    let baseRetryIntervalInSeconds = 5;
    var exponentialBackOff = baseRetryIntervalInSeconds * Math.pow(3, (retryCount + 1));
    return exponentialBackOff < MaxRetryLimitInSeconds ? exponentialBackOff : MaxRetryLimitInSeconds;
}

/**
 * This function checks a result of artifact download
 * @param  {Array<ArtifactDownloadTicket>} downloadTickets
 * @throws Exception if downloaded build artifact is not healthy
 * @returns void
 */
export function checkArtifactConsistency(downloadTickets: Array<ArtifactDownloadTicket>): void {
    tl.debug('Starting artifact consistency check');
    tl.debug(`Items count: ${ArtifactDownloadTicket.length}`);

    const corruptedItems: Array<ArtifactDownloadTicket> = downloadTickets.filter(ticket => isItemCorrupted(ticket));

    if (corruptedItems.length > 0) {
        console.log(tl.loc("CorruptedItemsList"));
        corruptedItems.map(item => {
            console.log(item.artifactItem.metadata.destinationUrl);
        });
        throw new Error(tl.loc('BuildArtifactNotHealthy'));
    }

    console.log(tl.loc('BuildArtifactHealthy'));
}

/**
 * This function investigates the download ticket of the artifact item. 
 * The item will be marked as corrupted if the `artifactItem.fileLength` 
 * (that is returned from the Azure DevOps itself) is not equal to `fileSizeInBytes` 
 * (that is returned from `artifact-engine` extension).
 * @param  {ArtifactDownloadTicket} ticket - download ticket of artifact item
 * @returns {boolean} `true` if item corrupted, `false` if item healthy
 */
function isItemCorrupted(ticket: ArtifactDownloadTicket): boolean {
    let isCorrupted: boolean = false;

    // We check the tickets only with processed status
    if (ticket.state === TicketState.Processed && ticket.artifactItem.itemType !== ItemType.Folder) {
        tl.debug(`Local path to the item: ${ticket.artifactItem.metadata.destinationUrl}`);

        let expectedBytesLength: number = 0;

        // The artifactItem.fileLength can be a string or undefined if the file size is 0
        if (Number.isInteger(ticket.artifactItem.fileLength)) {
            expectedBytesLength = ticket.artifactItem.fileLength;
        } else if (ticket.artifactItem.fileLength) {
            expectedBytesLength = Number(ticket.artifactItem.fileLength);
        } else {
            expectedBytesLength = 0;
        }

        const actualBytesLength: number = ticket.fileSizeInBytes;

        tl.debug(`   Expected length in bytes ${expectedBytesLength}`);
        tl.debug(`   Actual length in bytes ${actualBytesLength}`);
        tl.debug(`   Download size in bytes ${ticket.downloadSizeInBytes}`);

        isCorrupted = (expectedBytesLength !== actualBytesLength);

        tl.debug(`Result: ${isCorrupted ? 'Item is corrupted' : 'Item is healthy'}`)
    }

    return isCorrupted;
}
