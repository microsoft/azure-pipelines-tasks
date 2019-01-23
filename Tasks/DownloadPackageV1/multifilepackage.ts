import * as vsts from "vso-node-api/WebApi";
import * as locationUtility from "packaging-common/locationUtilities";

import { Package } from "./package";
import { PackageUrlsBuilder } from "./packagebuilder";

export class MultiFilePackage extends Package {
    private pattern: string;

    constructor(builder: PackageUrlsBuilder) {
        super(builder);
        this.pattern = builder.Pattern;
    }

    async getPackageFilesMetadata(connection: vsts.WebApi, queryParams?: any): Promise<Array<any>> {
        return new Promise<Array<any>>(async (resolve, reject) => {
            return this.getPackageMetadata(connection, queryParams)
                .then(async packageMetadata => {
                    console.log("md " + JSON.stringify(packageMetadata));
                    return resolve(packageMetadata.files);
                })
                .catch(error => {
                    return reject(error);
                });
        });
    }

    filterFilesMinimatch(fileMetadata): boolean {
        return fileMetadata.protocolMetadata.data.storageId != null;
    }

    getFileUrl(fileMetadata): Promise<string> {
        return null;
    }

    async getDownloadUrls(
        collectionUrl: string,
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, string>> {
        

        this.getPackageFilesMetadata(this.feedConnection, {
            feedId: feedId,
            packageId: packageId,
            packageVersionId: packageVersion
        }).then(packageFilesMetadata => {
            packageFilesMetadata
                .filter(this.filterFilesMinimatch)
                .map(this.getFileUrl)
        }).catch(error => { throw error; })

        return null;
    }

    // var packagesUrl = await locationUtility.getServiceUriFromAreaId(
    //     collectionUrl,
    //     this.accessToken,
    //     this.packageProtocolAreadId
    // );
    // var packageConnection = new vsts.WebApi(packagesUrl, this.credentialHandler);

    // var blobsUrl = await locationUtility.getServiceUriFromAreaId(
    //     collectionUrl,
    //     this.accessToken,
    //     "5294EF93-12A1-4D13-8671-9D9D014072C8"
    // );
    // var blobConnection = new vsts.WebApi(blobsUrl, this.credentialHandler);

    // var url = await this.getUrl(
    //     blobConnection.getCoreApi().vsoClient,
    //     "blob",
    //     "1D1857E7-3F76-4766-AC71-C443AB9093EF",
    //     {
    //         blobId: "423348167CA0632C749561A6CCC5073280599A826F6F707567FD4012C88DFAC000"
    //     }
    // );
    // console.log("Blbo " + url);

    // return new Promise<Map<string, string>>((resolve, reject) => {
    //     return this.getPackageMetadata(feedConnection, {
    //         feedId: feedId,
    //         packageId: packageId,
    //         packageVersionId: packageVersion
    //     })
    //         .then(async packageMetadata => {
    //             console.log("md " + JSON.stringify(packageMetadata));
    //             var downloadUrls =  new Map<string,string>();

    //             for (var i = 0; i < packageMetadata.files.length; i++) {
    //                 var packageFile = packageMetadata.files[i];
    //                 if(packageFile.protocolMetadata.data.storageId == null) {
    //                     continue;
    //                 }
    //                 await this.getUrl(
    //                     blobConnection.getCoreApi().vsoClient,
    //                     "blob",
    //                     "1D1857E7-3F76-4766-AC71-C443AB9093EF",
    //                     {
    //                         filename: packageFile.name,
    //                         // TODO contentType
    //                         // TODO expiry
    //                         blobId: packageFile.protocolMetadata.data.storageId
    //                     }
    //                 )
    //                     .then(downloadUrlMetadata => {
    //                         console.log("download url is " + downloadUrlMetadata);

    //                     })
    //                     .catch(error => {
    //                         console.log("download url error " + error);
    //                         throw error;
    //                     });
    //             }

    //             return resolve(downloadUrls);
    //         })
    //         .catch(error => {
    //             return reject(error);
    //         });
    // });
}
