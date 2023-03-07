import { DownloadHandler } from './DownloadHandler';
import { FilesystemProvider } from 'artifact-engine/Providers';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Handler for download artifact via local file share
 * @extends DownloadHandler
 * @example
 * const config: IBaseHandlerConfig = {...};
 * const downloadHandler: DownloadHandlerFilePath = new DownloadHandlerFilePath(config);
 * downloadHandler.downloadResources();
 */
export class DownloadHandlerFilePath extends DownloadHandler {
    /**
     * Get source provider with source folder.
     * Since we will work with local files we use `Filesystem Provider` as source provider.
     * @access protected
     * @returns {FilesystemProvider} Configured Filesystem Provider
     */
    protected getSourceProvider(): FilesystemProvider {
        const downloadUrl = this.config.artifactInfo.resource.data;
        const artifactName = this.config.artifactInfo.name.replace('/', '\\');
        let artifactLocation = path.join(downloadUrl, artifactName);

        console.log(tl.loc('DownloadArtifacts', artifactName, artifactLocation));

        if (!fs.existsSync(artifactLocation)) {
            console.log(tl.loc('ArtifactNameDirectoryNotFound', artifactLocation, downloadUrl));
            artifactLocation = downloadUrl;
        }

        const provider: FilesystemProvider = new FilesystemProvider(artifactLocation, artifactName);
        return provider;
    }

    /**
     * Get destination provider with destination folder.
     * Since we will work with local files we use `Filesystem Provider` as source provider.
     * @access protected
     * @returns {FilesystemProvider} Configured Filesystem Provider
     */
    protected getDestinationProvider(): FilesystemProvider {
        const provider: FilesystemProvider = new FilesystemProvider(this.config.downloadPath);
        return provider;
    }
}
