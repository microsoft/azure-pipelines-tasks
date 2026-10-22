import { Package, PackageFileResult } from "./package";
import { PackageUrlsBuilder } from "./packagebuilder";
import { match } from "azure-pipelines-task-lib";
import * as tl from "azure-pipelines-task-lib/task";

export class MultiFilePackage extends Package {
    private getRouteParams: (feedId: string, project: string, packageMetadata: any, fileMetadata: any) => any;
    private pattern: string[];

    constructor(builder: PackageUrlsBuilder) {
        super(builder);
        this.getRouteParams = builder.GetRouteParams;
        this.pattern = builder.Pattern;
    }

    filterFilesMinimatch(fileMetadatas: any[]): Set<string> {
        var files: string[] = fileMetadatas.reduce((files, fileMetadata) => {
            files.push(fileMetadata.name);
            return files;
        }, []);
        return new Set<string>(match(files, this.pattern));
    }

    async getDownloadUrls(feedId: string, project: string, packageId: string, packageVersion: string): Promise<Map<string, PackageFileResult>> {
        const packageMetadata = await this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                project: project,
                packageId: packageId,
                packageVersionId: packageVersion
            });

        var fileMetadatas: any[] = packageMetadata.files;
        tl.debug("Found " + fileMetadatas.length + " files in this package.");
        var filteredFileList: Set<string> = this.filterFilesMinimatch(fileMetadatas);
        tl.debug(filteredFileList.size + " files match filter criteria.");

        const fileContentPromises: Promise<PackageFileResult>[] = [];
        for (const fileMetadata of fileMetadatas) {
            if (filteredFileList.has(fileMetadata.name)) {
                fileContentPromises.push(
                    this.getPackageFileContent(fileMetadata, feedId, project, packageMetadata));
            }
        }

        const fileContents = await Promise.all(fileContentPromises);
        
        const fileContentsMap = new Map<string, PackageFileResult>();
        for (const fileContent of fileContents) {
            if(fileContent) {
                fileContentsMap[fileContent.FileName] = fileContent
            }
        }

        return fileContentsMap;
    }

    private async getPackageFileContent(fileMetadata: any, feedId: string, project: string, packageMetadata: any): Promise<PackageFileResult|null> {
        const protocolFileData = fileMetadata.protocolMetadata.data;

        // sometimes the file info has PascalCase keys, sometimes camelCase
        const storageId = protocolFileData.storageId || protocolFileData.StorageId;
        if (storageId) {
            tl.debug(`Getting download url for file ${fileMetadata.name}.`)
            
            try {
                const downloadUrl = await this.getUrl(
                    this.pkgsConnection.vsoClient,
                    this.packageProtocolAreaName,
                    this.packageProtocolDownloadAreadId,
                    this.getRouteParams(feedId, project, packageMetadata, fileMetadata));
    
                return new PackageFileResult(fileMetadata.name, downloadUrl, true);
            }
            catch(error) {
                    tl.debug("Getting download url for file " + fileMetadata.name + " failed with error: " + error);
                    throw error;
            }
        }

        const content = protocolFileData.content || protocolFileData.Content;
        if(content)
        {
            tl.debug(`Getting literal content for file ${fileMetadata.name}.`)

            return new PackageFileResult(fileMetadata.name, content, false);
        }
        
        tl.warning(tl.loc("SkippingFileWithNoContent", fileMetadata.name));
        return null;
    }
}
