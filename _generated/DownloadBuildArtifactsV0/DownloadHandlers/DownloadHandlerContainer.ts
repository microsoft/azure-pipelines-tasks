import { DownloadHandler } from './DownloadHandler';
import { IContainerHandlerConfig } from './HandlerConfigs';
import { WebProvider, FilesystemProvider } from 'artifact-engine/Providers';
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Handler for download artifact from related container resource.
 * Build Artifact will be downloaded via `_apis/resources/Containers/` resource.
 * @extends DownloadHandler
 * @example
 * const config: IContainerHandlerConfig = {...};
 * const downloadHandler: IContainerHandlerConfig = new IContainerHandlerConfig(config);
 * downloadHandler.downloadResources();
 */
export class DownloadHandlerContainer extends DownloadHandler {
    protected config: IContainerHandlerConfig;

    constructor(handlerConfig: IContainerHandlerConfig) {
        super(handlerConfig);
    }

    /**
     * To download artifact from container resource we will use `WebProvider` as source provider
     * @access protected
     * @returns {WebProvider} Configured Web Provider
    */
    protected getSourceProvider(): WebProvider {
        console.log(tl.loc('DownloadingContainerResource', this.config.artifactInfo.resource.data));
        const containerParts: Array<string> = this.config.artifactInfo.resource.data.split('/');

        if (containerParts.length < 3) {
            throw new Error(tl.loc('FileContainerInvalidArtifactData'));
        }

        const containerId: number = parseInt(containerParts[1]);
        let containerPath: string = containerParts.slice(2, containerParts.length).join('/');

        if (containerPath === '/') {
            //container REST api oddity. Passing '/' as itemPath downloads the first file instead of returning the meta data about the all the files in the root level.
            //This happens only if the first item is a file.
            containerPath = '';
        }

        const variables = {};
        const itemsUrl: string = `${this.config.endpointUrl}/_apis/resources/Containers/${containerId}?itemPath=${encodeURIComponent(containerPath)}&isShallow=true&api-version=4.1-preview.4`;

        console.log(tl.loc('DownloadArtifacts', this.config.artifactInfo.name, itemsUrl));

        const provider: WebProvider = new WebProvider(itemsUrl, this.config.templatePath, variables, this.config.handler);
        return provider;
    }

    /**
     * Since we download artifact to local storage we will use a `FilesystemProvider` as destination provider
     * @access protected
     * @returns {FilesystemProvider} Configured Filesystem Provider
    */
    protected getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.config.downloadPath);
        return provider;
    }
}
