import { debug as writeDebugInfo, loc as mapLocString } from 'azure-pipelines-task-lib/task';
import { ArtifactDownloadTicket, ItemType, TicketState } from 'artifact-engine/Models';
import { getFileSizeInBytes } from './file_helper';

/**
 * This function checks a result of artifact download
 * @param  {Array<ArtifactDownloadTicket>} downloadTickets
 * @throws Exception if downloaded build artifact is not healthy
 * @returns void
 */
export function checkArtifactConsistency(downloadTickets: Array<ArtifactDownloadTicket>): void {
    console.log(mapLocString('BeginCheckArtifactConsistency'));
    writeDebugInfo(`Items count: ${ArtifactDownloadTicket.length}`);

    const corruptedItems: Array<ArtifactDownloadTicket> = downloadTickets.filter(ticket => isItemCorrupted(ticket));

    if (corruptedItems.length > 0) {
        console.log(mapLocString("CorruptedItemsList"));
        
        corruptedItems.map(item => {
            console.log(item.artifactItem.metadata.destinationUrl);
        });
        
        throw new Error(mapLocString('BuildArtifactNotHealthy'));
    }

    console.log(mapLocString('BuildArtifactHealthy'));
}

/**
 * This function investigates the download ticket of the artifact item.
 * 
 * @param  {ArtifactDownloadTicket} ticket - download ticket of artifact item
 * @returns {boolean} `true` if item corrupted, `false` if item healthy
 */
function isItemCorrupted(ticket: ArtifactDownloadTicket): boolean {
    let isCorrupted: boolean = false;

    // We check the tickets only with processed status
    if ((ticket.state === TicketState.Processed) && (ticket.artifactItem.itemType !== ItemType.Folder)) {
        writeDebugInfo(`Start check for item: ${ticket.artifactItem.path}`);
        writeDebugInfo(`Getting info from download ticket`);

        const localPathToFile: string = ticket.artifactItem.metadata.destinationUrl;
        writeDebugInfo(`   Local path to the item: ${localPathToFile}`);

        let expectedBytesLength: number = 0;

        // The artifactItem.fileLength can be a string or undefined if the file size is 0
        if (Number.isInteger(ticket.artifactItem.fileLength)) {
            expectedBytesLength = ticket.artifactItem.fileLength;
        } else if (ticket.artifactItem.fileLength) {
            expectedBytesLength = Number(ticket.artifactItem.fileLength);
        } else {
            expectedBytesLength = 0;
        }
        writeDebugInfo(`   Expected length in bytes ${expectedBytesLength}`);

        const fileSizeInBytes: number = ticket.fileSizeInBytes;
        writeDebugInfo(`   Actual length in bytes ${fileSizeInBytes}`);

        const downloadSizeInBytes: number = ticket.downloadSizeInBytes;
        writeDebugInfo(`   Download size in bytes ${ticket.downloadSizeInBytes}`);

        if ((downloadSizeInBytes !== fileSizeInBytes) || (fileSizeInBytes !== expectedBytesLength)) {
            writeDebugInfo('Getting file size of downloaded file');

            const actualFileSize = getFileSizeInBytes(localPathToFile);
            writeDebugInfo(`   Size of file in local storage: ${actualFileSize}`);

            isCorrupted = (expectedBytesLength !== actualFileSize);
        } else {
            isCorrupted = (expectedBytesLength !== fileSizeInBytes);
        }

        writeDebugInfo(`Result: ${isCorrupted ? 'Item is corrupted' : 'Item is healthy'}`);
    }

    return isCorrupted;
}
