import { Package } from "./package";
import { PackageUrlsBuilder } from "./packagebuilder";
import { isRegExp } from "util";
import { filter } from "vsts-task-lib";
import { stringify } from "ltx";

export class MultiFilePackage extends Package {
    private pattern: string;
    private getRouteParamsMethod: (feedId: string, packageMetadata: any, fileMetadata: any) => any;

    constructor(builder: PackageUrlsBuilder) {
        super(builder);
        this.pattern = builder.Pattern;
        this.getRouteParamsMethod = builder.GetRouteParamsMethod;
    }

    filterFilesMinimatch(fileMetadata): boolean {
        return fileMetadata.protocolMetadata.data.storageId != null;
    }

    private async getPackageFileDownloadUrl(
        feedId: string,
        packageMetadata: any,
        fileMetadata: any
    ): Promise<Map<string, string>> {
        return new Promise<Map<string, string>>((resolve, reject) => {
            this.getUrl(
                this.pkgsConnection.getCoreApi().vsoClient,
                this.packageProtocolAreaName,
                this.packageProtocolDownloadAreadId,
                this.getRouteParamsMethod(feedId, packageMetadata, fileMetadata)
            )
                .then(downloadUrl => {
                    var url = new Map<string, string>();
                    url[fileMetadata.name] = downloadUrl;
                    return resolve(url);
                })
                .catch(error => {
                    console.log("error here " + error);
                    throw reject(error);
                });
        });
    }

    async getDownloadUrls(feedId: string, packageId: string, packageVersion: string): Promise<Map<string, string>> {
        return new Promise<Map<string, string>>((resolve, reject) => {
            return this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                packageId: packageId,
                packageVersionId: packageVersion
            })
                .then(packageMetadata => {
                    console.log("md " + JSON.stringify(packageMetadata));

                    var packageFilesMetada = packageMetadata.files.filter(this.filterFilesMinimatch);

                    var pkgFileUrlPromises: Promise<Map<string, string>>[] = [];

                    for (let i = 0; i < packageFilesMetada.length; i++) {
                        const fileMetadata = packageFilesMetada[i];
                        pkgFileUrlPromises.push(this.getPackageFileDownloadUrl(feedId, packageMetadata, fileMetadata));
                    }
                    return Promise.all(pkgFileUrlPromises)
                        .then(urls => {
                            var downloadUrls = new Map<string, string>();
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
