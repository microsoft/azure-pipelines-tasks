import * as vsts from "vso-node-api/WebApi";
import * as locationUtility from "packaging-common/locationUtilities";

import { PackageUrlsBuilder } from "./packagebuilder";
import { Package } from "./package";

export class SingleFilePackage extends Package {
    constructor(builder: PackageUrlsBuilder) {
        super(builder);
    }

    async getDownloadUrls(
        collectionUrl: string,
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Array<string>> {
        var feedsUrl = await locationUtility.getFeedUriFromBaseServiceUri(collectionUrl, this.accessToken);
        var feedConnection = new vsts.WebApi(feedsUrl, this.credentialHandler);

        // TODO fix this.
        var packagesUrl = await locationUtility.getServiceUriFromAreaId(collectionUrl, this.accessToken, this.packageProtocolAreadId);
        var packageConnection = new vsts.WebApi(packagesUrl, this.credentialHandler);

        return new Promise<Array<string>>((resolve, reject) => {
            return this.getPackageMetadata(feedConnection, {
                feedId: feedId,
                packageId: packageId
            })
                .then(packageMetadata => {
                    console.log("md " + JSON.stringify(packageMetadata));

                    var packageName = packageMetadata.name;
                    console.log("package Name " + packageName);
                
                    this.getUrl(
                        packageConnection.getCoreApi().vsoClient,
                        this.packageProtocolAreaName,
                        this.packageProtocolDownloadAreadId,
                        {
                            feedId: feedId,
                            packageName: packageName,
                            packageVersion: packageVersion
                        }
                    )
                        .then(downloadUrl => {
                            return resolve(new Array(downloadUrl));
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
