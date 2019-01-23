import { Package } from "./package";
import { PackageUrlsBuilder } from "./packagebuilder";

export class MultiFilePackage extends Package {
    private pattern: string;

    constructor(builder: PackageUrlsBuilder) {
        super(builder);
        this.pattern = builder.Pattern;
    }

    filterFilesMinimatch(fileMetadata): boolean {
        return fileMetadata.protocolMetadata.data.storageId != null;
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

                    var packageName = packageMetadata.protocolMetadata.data.name;
                    
                    return packageMetadata.files.filter(this.filterFilesMinimatch).map(async fileMetadata => {
                        var fileName = fileMetadata.name;
                        var artifactPath = `${packageMetadata.protocolMetadata.data.groupId.replace(new RegExp('\\.'), '/')}/${packageMetadata.protocolMetadata.data.artifactId}/${packageMetadata.protocolMetadata.data.version}/${fileName}`;

                        this.getUrl(
                            this.pkgsConnection.getCoreApi().vsoClient,
                            this.packageProtocolAreaName,
                            this.packageProtocolDownloadAreadId,
                            {
                                path: artifactPath,
                                feed: feedId
                            }

                            // {
                            //     feedId: feedId,
                            //     packageName: packageName,
                            //     packageVersion: packageVersion,
                            //     fileName: fileName
                            // }
                        )
                            .then(downloadUrl => {
                                var url = new Map<string, string>();
                                url[fileName] = downloadUrl;
                                return resolve(url);
                            })
                            .catch(error => {
                                console.log("error here " + error);
                                throw error;
                            });
                    });
                })
                .catch(error => {
                    return reject(error);
                });
        });

        // this.getPackageFilesMetadata(this.feedConnection, {
        //     feedId: feedId,
        //     packageId: packageId,
        //     packageVersionId: packageVersion
        // }).then(packageFilesMetadata => {

        //     packageName = packageFilesMetadata.protocolMetadata.data.name;

        //     packageFilesMetadata
        //         .filter(this.filterFilesMinimatch)
        //         .map(fileMetadata => {
        //             this.getUrl(
        //                 this.pkgsConnection.getCoreApi().vsoClient,
        //                 this.packageProtocolAreaName,
        //                 this.packageProtocolDownloadAreadId,
        //                 {
        //                     feedId: feedId,
        //                     packageName: packageFilesMetadata.protocolMetadata.data.name,
        //                     packageVersion: packageVersion,
        //                     fileName: fileMetadata.protocolMetadata.data.fileName
        //                 }
        //             )
        //                 .then(downloadUrl => {
        //                     var urls = new Map<string, string>();
        //                     urls[packageName +  this.extension] = downloadUrl;
        //                     return resolve(urls);
        //                 })
        //                 .catch(error => {
        //                     throw error;
        //                 });
        //         })
        // }).catch(error => { throw error; })
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
