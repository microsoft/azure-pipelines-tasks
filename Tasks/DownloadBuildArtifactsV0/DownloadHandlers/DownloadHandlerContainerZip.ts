import { DownloadHandler } from './DownloadHandler';
import { IContainerHandlerZipConfig } from './HandlerConfigs';
import { FilesystemProvider, ZipProvider } from 'artifact-engine/Providers';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as DecompressZip from 'decompress-zip';

/**
 * Handler for download artifact via build API
 * Build Artifact will be downloaded as zip archive via `/_apis/build/builds/` resource.
 * This handler was designed to work only on windows system.
 * @extends DownloadHandler
 * @example
 * const config: IContainerHandlerZipConfig = {...};
 * const downloadHandler: DownloadHandlerContainerZip = new DownloadHandlerContainerZip(config);
 * downloadHandler.downloadResources();
 */
export class DownloadHandlerContainerZip extends DownloadHandler {
    protected config: IContainerHandlerZipConfig;
    private readonly archiveUrl: string;
    private readonly zipLocation: string;

    constructor(handlerConfig: IContainerHandlerZipConfig) {
        super(handlerConfig);
        this.archiveUrl = `${this.config.endpointUrl}/${this.config.projectId}/_apis/build/builds/${this.config.buildId}/artifacts?artifactName=${this.config.artifactInfo.name}&$format=zip`;
        this.zipLocation = path.join(this.config.downloadPath, `${this.config.artifactInfo.name}.zip`);
    }

    /**
     * Unpack an archive with an artifact
     * @param unzipLocation path to the target artifact
     * @access private
     * @returns {Promise<void>} promise that will be resolved once the archive will be unpacked
    */
    private unzipContainer(unzipLocation: string): Promise<void> {
        const unZipPromise: Promise<void> = new Promise<void>((resolve, reject) => {
            if (!tl.exist(this.zipLocation)) {
                return resolve();
            }

            tl.debug(`Extracting ${this.zipLocation} to ${unzipLocation}`);

            const unzipper = new DecompressZip(this.zipLocation);

            unzipper.on('error', err => {
                return reject(tl.loc('ExtractionFailed', err));
            });

            unzipper.on('extract', log => {
                tl.debug(`Extracted ${this.zipLocation} to ${unzipLocation} successfully`);
                return resolve();
            });

            unzipper.extract({
                path: unzipLocation
            });

        });

        return unZipPromise;
    }

    /**
     * Get zip provider.
     * Since we will download archived artifact we will use `ZipProvider` as source provider.
     * @access protected
     * @returns {ZipProvider} Configured Zip Provider
    */
    protected getSourceProvider(): ZipProvider {
        console.log(tl.loc('DownloadArtifacts', this.config.artifactInfo.name, this.archiveUrl));
        const provider: ZipProvider = new ZipProvider(this.archiveUrl, this.config.handler);
        return provider;
    }

    /**
     * Get filesystem provider.
     * Since we download artifact to local storage we will use a `FilesystemProvider` as destination provider.
     * @access protected
     * @returns {FilesystemProvider} Configured Filesystem Provider
    */
    protected getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.zipLocation);
        return provider;
    }

    /**
     * Download and unpack an archive with an artifact.
     * @access public
    */
    public downloadResources(): Promise<any> {
        const downloadProcess: Promise<any> = new Promise((resolve, reject) => {
            tl.debug('Starting downloadZip action');

            if (tl.exist(this.zipLocation)) {
                tl.rmRF(this.zipLocation);
            }

            super.downloadResources().then(() => {
                tl.debug(`Successfully downloaded from ${this.archiveUrl}`);

                this.unzipContainer(this.config.downloadPath).then(() => {
                    tl.debug(`Successfully extracted ${this.zipLocation}`);

                    if (tl.exist(this.zipLocation)) {
                        tl.rmRF(this.zipLocation);
                    }

                    resolve();

                }).catch((error) => {
                    reject(error);
                });

            }).catch((error) => {
                reject(error);
            });
        });

        return downloadProcess;
    }
}
