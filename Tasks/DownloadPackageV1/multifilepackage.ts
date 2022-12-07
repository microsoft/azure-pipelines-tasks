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

    private async getPackageFileDownloadUrl(
        feedId: string,
        project: string,
        packageMetadata: any,
        fileMetadata: any
    ): Promise<Map<string, PackageFileResult>> {
        return new Promise<Map<string, PackageFileResult>>((resolve, reject) => {
            this.getUrl(
                this.pkgsConnection.vsoClient,
                this.packageProtocolAreaName,
                this.packageProtocolDownloadAreadId,
                this.getRouteParams(feedId, project, packageMetadata, fileMetadata)
            )
                .then(downloadUrl => {
                    var url = new Map<string, PackageFileResult>();
                    url[fileMetadata.name] = new PackageFileResult(downloadUrl, true);
                    return resolve(url);
                })
                .catch(error => {
                    tl.debug("Getting download url for file " + fileMetadata.name + " failed with error: " + error);
                    throw reject(error);
                });
        });
    }

    private async getPackageFileContent(fileMetadata: any): Promise<Map<string, PackageFileResult>> {
        return new Promise<Map<string, PackageFileResult>>((resolve, reject) => {
            var resultMap = new Map<string, PackageFileResult>();
            let fileContent = fileMetadata.protocolMetadata.data.content || fileMetadata.protocolMetadata.data.Content;
            var content = fileContent as string;

            if(typeof content !='undefined' && content)
            {
                resultMap[fileMetadata.name] = new PackageFileResult(content, false);
                return resolve(resultMap);
            }

            throw reject('Unable to download package with empty content.');
        });
    }

    async getDownloadUrls(feedId: string, project: string, packageId: string, packageVersion: string): Promise<Map<string, PackageFileResult>> {
        return new Promise<Map<string, PackageFileResult>>((resolve, reject) => {
            return this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                project: project,
                packageId: packageId,
                packageVersionId: packageVersion
            })
                .then(packageMetadata => {
                    var fileMetadatas: any[] = packageMetadata.files;
                    tl.debug("Found " + fileMetadatas.length + " files in this package.");
                    var filteredFileList: Set<string> = this.filterFilesMinimatch(fileMetadatas);
                    tl.debug(filteredFileList.size + " files match filter criteria.");

                    var pkgFileUrlPromises: Promise<Map<string, PackageFileResult>>[] = [];

                    for (let i = 0; i < fileMetadatas.length; i++) {
                        if (filteredFileList.has(fileMetadatas[i].name)) {
                            const fileMetadata = fileMetadatas[i];
                            pkgFileUrlPromises.push(
                                (fileMetadata.protocolMetadata.data.StorageId != null || fileMetadata.protocolMetadata.data.storageId != null)
                                    ? this.getPackageFileDownloadUrl(feedId, project, packageMetadata, fileMetadata)
                                    : this.getPackageFileContent(fileMetadata)
                            );
                        }
                    }
                    return Promise.all(pkgFileUrlPromises)
                        .then(urls => {
                            var downloadUrls = new Map<string, PackageFileResult>();
                            urls.forEach(url => {
                                downloadUrls = { ...downloadUrls, ...url };
                            });
                            return resolve(downloadUrls);
                        })
                        .catch(error => {
                            throw error;
                        });
                })
                .catch(error => {
                    return reject(error);
                });
        });
    }
}
