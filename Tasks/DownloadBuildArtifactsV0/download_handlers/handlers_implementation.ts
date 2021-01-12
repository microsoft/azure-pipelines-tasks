import { IBaseHandlerConfig, IContainerHandlerConfig, IContainerHandlerZipConfig } from './handlers_config'
import { handlerCheckDownloadedFiles } from "../download_helper";
import { WebProvider, FilesystemProvider, ZipProvider, } from 'artifact-engine/Providers';
import { ArtifactEngine } from 'artifact-engine/Engine';
import { IArtifactProvider, ArtifactDownloadTicket } from 'artifact-engine/Models';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';
import * as DecompressZip from "decompress-zip";

abstract class DownloadHandler {
    config: IBaseHandlerConfig;

    constructor(handlerConfig: IBaseHandlerConfig) {
        this.config = handlerConfig;
    }

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
                        tl.warning('Check of downloaded files not passed. Now trying to download the build artifact again.');
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
    };

    public abstract getSourceProvider(): IArtifactProvider;
    public abstract getDestinationProvider(): IArtifactProvider;
}

export class DownloadHandlerContainer extends DownloadHandler {
    config: IContainerHandlerConfig;

    public getSourceProvider(): WebProvider {
        console.log(tl.loc("DownloadingContainerResource", this.config.artifactInfo.resource.data));
        const containerParts: Array<string> = this.config.artifactInfo.resource.data.split('/');

        if (containerParts.length < 3) {
            throw new Error(tl.loc("FileContainerInvalidArtifactData"));
        }

        const containerId: number = parseInt(containerParts[1]);
        let containerPath: string = containerParts.slice(2, containerParts.length).join('/');

        if (containerPath == "/") {
            //container REST api oddity. Passing '/' as itemPath downloads the first file instead of returning the meta data about the all the files in the root level. 
            //This happens only if the first item is a file.
            containerPath = ""
        }

        const variables = {};
        const itemsUrl: string = `${this.config.endpointUrl}/_apis/resources/Containers/${containerId}?itemPath=${encodeURIComponent(containerPath)}&isShallow=true&api-version=4.1-preview.4`;

        console.log(tl.loc("DownloadArtifacts", this.config.artifactInfo.name, itemsUrl));

        const provider: WebProvider = new WebProvider(itemsUrl, this.config.templatePath, variables, this.config.handler);
        return provider;
    }

    public getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.config.downloadPath);
        return provider;
    }
}

export class DownloadHandlerFilePath extends DownloadHandler {
    public getSourceProvider(): FilesystemProvider {
        let downloadUrl = this.config.artifactInfo.resource.data;
        let artifactName = this.config.artifactInfo.name.replace('/', '\\');
        let artifactLocation = path.join(downloadUrl, artifactName);

        if (!fs.existsSync(artifactLocation)) {
            console.log(tl.loc("ArtifactNameDirectoryNotFound", artifactLocation, downloadUrl));
            artifactLocation = downloadUrl;
        }

        const provider: FilesystemProvider = new FilesystemProvider(artifactLocation, artifactName);
        return provider;
    }

    public getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.config.downloadPath);
        return provider;
    }
}

export class DownloadHandlerContainerZip extends DownloadHandler {
    config: IContainerHandlerZipConfig;
    readonly archiveUrl: string;
    readonly zipLocation: string;

    constructor(handlerConfig: IContainerHandlerZipConfig) {
        super(handlerConfig);
        this.archiveUrl = `${this.config.endpointUrl}/${this.config.projectId}/_apis/build/builds/${this.config.buildId}/artifacts?artifactName=${this.config.artifactInfo.name}&$format=zip`;
        this.zipLocation = path.join(this.config.downloadPath, `${this.config.artifactInfo.name}.zip`);
    };

    public downloadResources(): Promise<any> {
        const downloadProcess: Promise<any> = new Promise((resolve, reject) => {
            tl.debug("Starting downloadZip action");

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

    private unzipContainer(unzipLocation: string): Promise<void> {
        const unZipPromise: Promise<void> = new Promise<void>((resolve, reject) => {
            if (!tl.exist(this.zipLocation)) {
                return resolve();
            }

            tl.debug(`Extracting ${this.zipLocation} to ${unzipLocation}`);

            const unzipper = new DecompressZip(this.zipLocation);

            unzipper.on('error', err => {
                return reject(tl.loc("ExtractionFailed", err))
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

    public getSourceProvider(): ZipProvider {
        console.log(tl.loc("DownloadArtifacts", this.config.artifactInfo.name, this.archiveUrl));
        const provider: ZipProvider = new ZipProvider(this.archiveUrl, this.config.handler);
        return provider;
    }

    public getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.zipLocation);
        return provider;
    }
}
