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

    async getDownloadUrls(
        collectionUrl: string,
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<string[]> { 
       
        var feedsUrl = await locationUtility.getFeedUriFromBaseServiceUri(collectionUrl, this.accessToken);
        var feedConnection = new vsts.WebApi(feedsUrl, this.credentialHandler);

        var packagesUrl = await locationUtility.getNuGetUriFromBaseServiceUri(collectionUrl, this.accessToken);
        var packageConnection = new vsts.WebApi(packagesUrl, this.credentialHandler);
        
        await this.getPackageMetadata(feedConnection, { feedId: feedId, packageId: packageId, packageVersionId: packageVersion })
            .then(packageMetadata => {
                console.log("md " + JSON.stringify(packageMetadata))
            })
            .catch(error => { throw error; });

        return null;
    }
}
