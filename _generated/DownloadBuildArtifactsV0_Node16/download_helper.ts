import { debug, loc } from 'azure-pipelines-task-lib/task';
import { ArtifactDownloadTicket, ItemType, TicketState } from 'artifact-engine/Models';
import { getFileSizeInBytes } from './file_helper';

/**
 * This function checks a result of artifact download
 * @param  {Array<ArtifactDownloadTicket>} downloadTickets
 * @throws Exception if downloaded build artifact is not healthy
 * @returns void
 */
export function handlerCheckDownloadedFiles(downloadTickets: Array<ArtifactDownloadTicket>): void {
    console.log(loc('BeginArtifactItemsIntegrityCheck'));
    debug(`Items count: ${downloadTickets.length}`);

    const corruptedItems: Array<ArtifactDownloadTicket> = downloadTickets.filter(ticket => isItemCorrupted(ticket));

    if (corruptedItems.length > 0) {
        console.log(loc('CorruptedArtifactItemsList'));
        corruptedItems.map(item => console.log(item.artifactItem.metadata.destinationUrl));

        throw new Error(loc('IntegrityCheckNotPassed'));
    }

    console.log(loc('IntegrityCheckPassed'));
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
    if (ticket.state === TicketState.Processed &&
        ticket.artifactItem.itemType === ItemType.File) {
        debug(`Start check for item: ${ticket.artifactItem.path}`);
        debug(`Getting info from download ticket`);

        const localPathToFile: string = ticket.artifactItem.metadata.destinationUrl;
        debug(`Local path to the item: ${localPathToFile}`);

        if (ticket.artifactItem.fileLength) {
            const expectedBytesLength: number = Number(ticket.artifactItem.fileLength);

            if (isNaN(expectedBytesLength)) {
                debug('Incorrect data in related download ticket, skip item validation.');
                isCorrupted = true;
            } else {
                debug(`Expected length in bytes ${expectedBytesLength}`);

                try {
                    const actualBytesLength = getFileSizeInBytes(localPathToFile);
                    debug(`Actual length in bytes ${actualBytesLength}`);
                    isCorrupted = (expectedBytesLength !== actualBytesLength);
                } catch (error) {
                    debug('Unable to get file stats from local storage due to the following error:');
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

                return (expectedBytesLength !== actualBytesLength);
            } catch (error) {
                debug('Unable to get file stats from local storage due to the following error:');
                debug(error);
                debug('Skip item validation');
                isCorrupted = true;
            }
        }
    }

    return isCorrupted;
}

/**
 * This function resolves the value for the `parallelProcessingLimit` option of `ArtifactEngine`
 *
 * Earlier the only way to set parallelProcessingLimit in the task
 * was by declaring the `release.artifact.download.parallellimit` variable.
 *
 * To maintain backward compatibility we will use the following strategy:
 *
 * Firstly, investigate the `release.artifact.download.parallellimit` variable.
 * If everything is okay with this variable, the task will use the value from this variable.
 *
 * Secondly, investigate the `Parallelization limit` input of the task.
 * If everything is okay with the value in the related task's input, the task will use the value from this input.
 *
 * If validation failed for both cases the function will return the `defaultLimit` for the `parallelProcessingLimit` option.
 *
 * @param {string} artifactDownloadLimit - value of `release.artifact.download.parallellimit` variable
 * @param {string} taskLimit - value of `Parallelization limit` task input
 * @param {number} defaultLimit - the default value that will be returned if `artifactDownloadLimit` and `taskLimit` contain invalid values.
 * @returns {number} - parallel processing limit
 */
export function resolveParallelProcessingLimit(artifactDownloadLimit: string, taskLimit: string, defaultLimit: number): number {
    debug(`Checking value of the "release.artifact.download.parallellimit" variable - ${artifactDownloadLimit}`);
    const artifactDownloadParallelLimit: number = Number(artifactDownloadLimit);
    if (isParallelProcessingLimitCorrect(artifactDownloadParallelLimit)) {
        return artifactDownloadParallelLimit;
    }

    debug(`Checking value of the "Parallelization limit" input - ${taskLimit}`);
    const taskInputParallelLimit: number = Number(taskLimit);
    if (isParallelProcessingLimitCorrect(taskInputParallelLimit)) {
        return taskInputParallelLimit;
    }

    debug(`The parallelization limit is set to default value - ${defaultLimit}`);
    return defaultLimit;
}

/**
 * This function checks the input value for the `parallelProcessingLimit` option of `ArtifactEngine`
 *
 * The parallel processing limit must be a number greater than 0.
 *
 * @param {number} limit - value of parallel processing limit
 * @returns {boolean} true if parallel processing limit is correct, false otherwise.
 */
function isParallelProcessingLimitCorrect(limit: number): boolean {
    const isCorrect: boolean = (!isNaN(limit) && limit > 0);

    if (isCorrect) {
        debug(`The value is correct, the parallelization limit is set to ${limit}`);
    } else {
        debug(`The value is incorrect ${limit}`);
    }

    return isCorrect;
}
