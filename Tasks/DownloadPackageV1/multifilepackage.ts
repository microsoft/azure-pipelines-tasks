import { Package, Result } from "./package";
import { PackageUrlsBuilder } from "./packagebuilder";
import { match } from "vsts-task-lib";

export class MultiFilePackage extends Package {
    private getRouteParams: (feedId: string, packageMetadata: any, fileMetadata: any) => any;
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
        packageMetadata: any,
        fileMetadata: any
    ): Promise<Map<string, Result>> {
        return new Promise<Map<string, Result>>((resolve, reject) => {
            this.getUrl(
                this.pkgsConnection.vsoClient,
                this.packageProtocolAreaName,
                this.packageProtocolDownloadAreadId,
                this.getRouteParams(feedId, packageMetadata, fileMetadata)
            )
                .then(downloadUrl => {
                    var url = new Map<string, Result>();
                    url[fileMetadata.name] = new Result(downloadUrl, true);
                    return resolve(url);
                })
                .catch(error => {
                    throw reject(error);
                });
        });
    }

    private async getPackageFileContent(fileMetadata: any): Promise<Map<string, Result>> {
        return new Promise<Map<string, Result>>(resolve => {
            var resultMap = new Map<string, Result>();
            resultMap[fileMetadata.name] = new Result(fileMetadata.protocolMetadata.data.content, false);
            return resolve(resultMap);
        });
    }

    async getDownloadUrls(feedId: string, packageId: string, packageVersion: string): Promise<Map<string, Result>> {
        return new Promise<Map<string, Result>>((resolve, reject) => {
            return this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                packageId: packageId,
                packageVersionId: packageVersion
            })
                .then(packageMetadata => {
                    var fileMetadatas = packageMetadata.files;
                    var filteredFileList: Set<string> = this.filterFilesMinimatch(fileMetadatas);

                    var pkgFileUrlPromises: Promise<Map<string, Result>>[] = [];

                    for (let i = 0; i < fileMetadatas.length; i++) {
                        if (filteredFileList.has(fileMetadatas[i].name)) {
                            const fileMetadata = fileMetadatas[i];
                            pkgFileUrlPromises.push(
                                fileMetadata.protocolMetadata.data.storageId != null
                                    ? this.getPackageFileDownloadUrl(feedId, packageMetadata, fileMetadata)
                                    : this.getPackageFileContent(fileMetadata)
                            );
                        }
                    }
                    return Promise.all(pkgFileUrlPromises)
                        .then(urls => {
                            var downloadUrls = new Map<string, Result>();
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
