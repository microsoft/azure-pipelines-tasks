import { IBaseHandlerConfig } from './HandlerConfigs';
import { handlerCheckDownloadedFiles } from '../download_helper';
import { ArtifactEngine } from 'artifact-engine/Engine';
import { IArtifactProvider, ArtifactDownloadTicket } from 'artifact-engine/Models';
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Base class for artifact download handlers
 */
export abstract class DownloadHandler {
    /**
     * @member {IBaseHandlerConfig} - contains info for generate source and destination providers
     * @access protected
     */
    protected config: IBaseHandlerConfig;

    constructor(handlerConfig: IBaseHandlerConfig) {
        this.config = handlerConfig;
    }

    /**
     * Pure abstract method for getting Source Provider.
     * Source Provider is an object that contains info about from where we will download the artifact.
     * @access protected
     * @returns {IArtifactProvider} Objects that implement the IArtifactProvider interface
    */
    protected abstract getSourceProvider(): IArtifactProvider;

    /**
     * Pure abstract method for getting Destination Provider.
     * Destination Provider is an object that contains info about where we will download artifacts.
     * @access protected
     * @returns {IArtifactProvider} Objects that implement the IArtifactProvider interface
    */
    protected abstract getDestinationProvider(): IArtifactProvider;

    /**
     * Method to download Build Artifact.
     * Since the logic for downloading builds artifacts is the same for all
     * types of source and destination providers, we will implement this logic in the base class.
     * @access public
     * @returns {Promise<Array<ArtifactDownloadTicket>>} an array of Download Tickets
    */
    public async downloadResources(): Promise<Array<ArtifactDownloadTicket>> {
        const downloader: ArtifactEngine = new ArtifactEngine();
        const sourceProvider: IArtifactProvider = this.getSourceProvider();
        const destinationProvider: IArtifactProvider = this.getDestinationProvider();

        const downloadPromise: Promise<Array<ArtifactDownloadTicket>> = new Promise<Array<ArtifactDownloadTicket>>(async (downloadComplete, downloadFailed) => {
            try {
                // First attempt to download artifact
                const downloadTickets: Array<ArtifactDownloadTicket> = await downloader.processItems(sourceProvider, destinationProvider, this.config.downloaderOptions);

                // We will proceed with the files check only if the "Check download files" option enabled
                if (this.config.checkDownloadedFiles && Array.isArray(downloadTickets)) {
                    try {
                        // Launch the files check, if all files are fully downloaded no exceptions will be thrown.
                        handlerCheckDownloadedFiles(downloadTickets);
                        downloadComplete(downloadTickets);
                    } catch (error) {
                        downloadFailed(error);
                    }
                } else {
                    downloadComplete(downloadTickets);
                }
            } catch (error) {
                downloadFailed(error);
            }
        });

        return downloadPromise;
    }
}
