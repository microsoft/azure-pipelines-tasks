import { PackageUrlsBuilder } from "./packagebuilder";
import { Package, Result } from "./package";

export class SingleFilePackage extends Package {
    constructor(builder: PackageUrlsBuilder) {
        super(builder);
    }

    async getDownloadUrls(
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, Result>> {
        return new Promise<Map<string, Result>>((resolve, reject) => {
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
                            var urls = new Map<string, Result>();
                            urls[packageName +  this.extension] = new Result(downloadUrl, true);
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
