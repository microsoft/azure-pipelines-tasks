import { PackageUrlsBuilder } from "./packagebuilder";
import { Package } from "./package";

export class SingleFilePackage extends Package {
    constructor(builder: PackageUrlsBuilder) {
        super(builder);
    }

    async getDownloadUrls(
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, string>> {
        return new Promise<Map<string, string>>((resolve, reject) => {
            return this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                packageId: packageId
            })
                .then(packageMetadata => {
                    console.log("md " + JSON.stringify(packageMetadata));

                    var packageName = packageMetadata.name;                
                    this.getUrl(
                        this.pkgsConnection.getCoreApi().vsoClient,
                        this.packageProtocolAreaName,
                        this.packageProtocolDownloadAreadId,
                        {
                            feedId: feedId,
                            packageName: packageName,
                            packageVersion: packageVersion
                        }
                    )
                        .then(downloadUrl => {
                            var urls = new Map<string, string>();
                            urls[packageName +  this.extension] = downloadUrl;
                            return resolve(urls);
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
