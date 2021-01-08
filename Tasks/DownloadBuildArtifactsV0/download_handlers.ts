import { IBaseHandlerConfig, IContainerHandlerConfig, handlerCheckDownloadedFiles } from './download_helper'
import { WebProvider, FilesystemProvider, } from 'artifact-engine/Providers';
import { ArtifactEngine } from 'artifact-engine/Engine';
import { IArtifactProvider, ArtifactDownloadTicket } from 'artifact-engine/Models';
import { loc } from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

abstract class Handler {
    config: IBaseHandlerConfig;

    constructor(handlerConfig: IBaseHandlerConfig) {
        this.config = handlerConfig;
    }

    public async downloadResources(): Promise<Array<ArtifactDownloadTicket>> {
        const downloader: ArtifactEngine = new ArtifactEngine();
        const sourceProvider: IArtifactProvider = this.getSourceProvider();
        const destinationProvider: IArtifactProvider = this.getDestinationProvider();

        // First attempt to download artifact
        const result: Array<ArtifactDownloadTicket> = await downloader.processItems(sourceProvider, destinationProvider, this.config.downloaderOptions);

        // We will proceed with the files check only if the "Check download files" option enabled
        if (this.config.checkDownloadedFiles && Array.isArray(result)) {
            // Launch the files check, if all files are fully downloaded no exceptions will be thrown.
            handlerCheckDownloadedFiles(result);
        }

        return result;
    };

    public abstract getSourceProvider(): IArtifactProvider;
    public abstract getDestinationProvider(): IArtifactProvider;
}

export class HandlerContainer extends Handler {
    config: IContainerHandlerConfig;

    public getSourceProvider(): WebProvider {
        console.log(loc("DownloadingContainerResource", this.config.artifactInfo.resource.data));
        var containerParts = this.config.artifactInfo.resource.data.split('/');

        if (containerParts.length < 3) {
            throw new Error(loc("FileContainerInvalidArtifactData"));
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

        console.log(loc("DownloadArtifacts", this.config.artifactInfo.name, itemsUrl));

        const provider: WebProvider = new WebProvider(itemsUrl, this.config.templatePath, variables, this.config.handler);
        return provider;
    }

    public getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.config.downloadPath);
        return provider;
    }
}

export class HandlerFilePath extends Handler {
    public getSourceProvider(): FilesystemProvider {
        let downloadUrl = this.config.artifactInfo.resource.data;
        let artifactName = this.config.artifactInfo.name.replace('/', '\\');
        let artifactLocation = path.join(downloadUrl, artifactName);

        if (!fs.existsSync(artifactLocation)) {
            console.log(loc("ArtifactNameDirectoryNotFound", artifactLocation, downloadUrl));
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
