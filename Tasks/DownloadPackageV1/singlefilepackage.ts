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
    ): Promise<string[]> {

        var feedsUrl = await locationUtility.getFeedUriFromBaseServiceUri(collectionUrl, this.accessToken);
        var feedConnection = new vsts.WebApi(feedsUrl, this.credentialHandler);

        await this.getPackageMetadata(feedConnection, { feedId: feedId, packageId: packageId })
            .then(packageMetadata => {
                console.log("md " + JSON.stringify(packageMetadata))

            })
            .catch(error => { throw error; });

        return null;
    }

}
