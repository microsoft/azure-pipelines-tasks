import { debug, loc } from 'azure-pipelines-task-lib/task';
import { ArtifactEngineOptions } from 'artifact-engine/Engine';
import { ArtifactDownloadTicket, ItemType, TicketState } from 'artifact-engine/Models';
import { getFileSizeInBytes } from './file_helper';
import { BuildArtifact } from 'azure-devops-node-api/interfaces/BuildInterfaces'

export interface IBaseHandlerConfig {
    artifactInfo: BuildArtifact,
    downloadPath: string,
    downloaderOptions: ArtifactEngineOptions,
    checkDownloadedFiles: boolean,
    retryLimit: number
}

export interface IContainerHandlerConfig extends IBaseHandlerConfig {
    endpointUrl: string,
    templatePath: string,
    handler: any,
}

/**
 * Just a Promise wrapper for setTimeout function
 * @param {number} interval - timeout interval in milliseconds
 */
export function timeoutPromise(interval: number): Promise<{}> {
    debug(`Wait for ${interval} milliseconds`);
    return new Promise(resolve => setTimeout(resolve, interval));
}

/**
 * This function checks a result of artifact download
 * @param  {Array<ArtifactDownloadTicket>} downloadTickets
 * @throws Exception if downloaded build artifact is not healthy
 * @returns void
 */
export function handlerCheckDownloadedFiles(downloadTickets: Array<ArtifactDownloadTicket>): void {
    debug(`Items count: ${downloadTickets.length}`);

    const corruptedItems: Array<ArtifactDownloadTicket> = downloadTickets.filter(ticket => isItemCorrupted(ticket));

    if (corruptedItems.length > 0) {
        console.log(loc("CorruptedItemsList"));
        corruptedItems.map(item => console.log(item.artifactItem.metadata.destinationUrl));

        throw new Error(loc('BuildArtifactNotHealthy'));
    }

    console.log(loc('BuildArtifactHealthy'));
}

/**
 * This function investigates the download ticket of the artifact item.
 * 
 * Since artifact's items stored as compressed files the only appropriate way (at the moment) 
 * to make sure that the item fully downloaded is to compare bytes length before compress 
 * that provided by Azure DevOps and actual bytes length from local storage.
 * 
 * @param  {ArtifactDownloadTicket} ticket - download ticket of artifact item
 * @returns {boolean} `true` if item corrupted, `false` if item healthy
 */
function isItemCorrupted(ticket: ArtifactDownloadTicket): boolean {
    let isCorrupted: boolean = false;

    // We check the tickets only with processed status and File item type 
    if ((ticket.state === TicketState.Processed) && (ticket.artifactItem.itemType === ItemType.File)) {
        debug(`Start check for item: ${ticket.artifactItem.path}`);
        debug(`Getting info from download ticket`);

        const localPathToFile: string = ticket.artifactItem.metadata.destinationUrl;
        debug(`Local path to the item: ${localPathToFile}`);

        if (ticket.artifactItem.fileLength) {
            const expectedBytesLength: number = Number(ticket.artifactItem.fileLength);

            if (expectedBytesLength === NaN) {
                debug('Incorrect data in related download ticket, skip item validation.');
                isCorrupted = true;
            } else {
                debug(`Expected length in bytes ${expectedBytesLength}`);

                let actualBytesLength: number = -1;

                try {
                    actualBytesLength = getFileSizeInBytes(localPathToFile);
                    debug(`Actual length in bytes ${actualBytesLength}`);
                    isCorrupted = (expectedBytesLength !== actualBytesLength);
                } catch (error) {
                    debug("Unable to get file stats from local storage due to the following error:");
                    debug(error);
                    debug('Skip item validation');
                    isCorrupted = true;
                }
            }
        } else if (ticket.artifactItem.metadata.downloadUrl.endsWith('format=zip')) {
            // When we use a Zip Provider the Artifact Engine returns only "fileSizeInBytes"
            try {
                const expectedBytesLength: number = Number(ticket.fileSizeInBytes);
                const actualBytesLength: number = getFileSizeInBytes(localPathToFile);

                debug(`Expected length in bytes ${expectedBytesLength}`);
                debug(`Actual length in bytes ${actualBytesLength}`);

                isCorrupted = (expectedBytesLength !== actualBytesLength);
            } catch (error) {
                debug("Unable to get file stats from local storage due to the following error:");
                debug(error);
                debug('Skip item validation');
                isCorrupted = true;
            }
        }
    }

    return isCorrupted;
}

function getRetryIntervalInSeconds(retryCount: number): number {
    let MaxRetryLimitInSeconds = 360;
    let baseRetryIntervalInSeconds = 5;
    var exponentialBackOff = baseRetryIntervalInSeconds * Math.pow(3, (retryCount + 1));
    return exponentialBackOff < MaxRetryLimitInSeconds ? exponentialBackOff : MaxRetryLimitInSeconds;
}

export function executeWithRetries(operationName: string, operation: () => Promise<any>, retryCount): Promise<any> {
    var executePromise = new Promise((resolve, reject) => {
        executeWithRetriesImplementation(operationName, operation, retryCount, resolve, reject, retryCount);
    });

    return executePromise;
}

function executeWithRetriesImplementation(operationName: string, operation: () => Promise<any>, currentRetryCount, resolve, reject, retryCountLimit) {
    operation().then((result) => {
        resolve(result);
    }).catch((error) => {
        if (currentRetryCount <= 0) {
            error(loc("OperationFailed", operationName, error));
            reject(error);
        }
        else {
            console.log(loc('RetryingOperation', operationName, currentRetryCount));
            currentRetryCount = currentRetryCount - 1;
            setTimeout(() => executeWithRetriesImplementation(operationName, operation, currentRetryCount, resolve, reject, retryCountLimit), getRetryIntervalInSeconds(retryCountLimit - currentRetryCount) * 1000);
        }
    });
}
