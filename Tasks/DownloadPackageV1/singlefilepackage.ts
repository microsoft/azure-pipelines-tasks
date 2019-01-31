import { PackageUrlsBuilder } from "./packagebuilder";
import { Package, Result } from "./package";
import * as tl from "vsts-task-lib/task";

export class SingleFilePackage extends Package {
    constructor(builder: PackageUrlsBuilder) {
        super(builder);
    }

    async getDownloadUrls(feedId: string, packageId: string, packageVersion: string): Promise<Map<string, Result>> {
        return new Promise<Map<string, Result>>((resolve, reject) => {
            return this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                packageId: packageId
            })
                .then(packageMetadata => {
                    tl.debug("Getting download url for package " + packageMetadata.name);
                    var packageName = packageMetadata.name;
                    this.getUrl(
                        this.pkgsConnection.vsoClient,
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
                            urls[packageName + this.extension] = new Result(downloadUrl, true);
                            return resolve(urls);
                        })
                        .catch(error => {
                            tl.debug("Getting download url for package failed with error: " + error);
                            return reject(error);
                        });
                })
                .catch(error => {
                    return reject(error);
                });
        });
    }
}
