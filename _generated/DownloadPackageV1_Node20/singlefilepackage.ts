import { PackageUrlsBuilder } from "./packagebuilder";
import { Package, PackageFileResult } from "./package";
import * as tl from "azure-pipelines-task-lib/task";

export class SingleFilePackage extends Package {
    constructor(builder: PackageUrlsBuilder) {
        super(builder);
    }

    async getDownloadUrls(feedId: string, project: string, packageId: string, packageVersion: string): Promise<Map<string, PackageFileResult>> {
        return new Promise<Map<string, PackageFileResult>>((resolve, reject) => {
            return this.getPackageMetadata(this.feedConnection, {
                feedId: feedId,
                project: project,
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
                            project: project,
                            packageName: packageName,
                            packageVersion: packageVersion
                        }
                    )
                        .then(downloadUrl => {
                            var urls = new Map<string, PackageFileResult>();
                            const fileName = packageName.replace(/\//g, '_') + this.extension;
                            urls[fileName] = new PackageFileResult(fileName, downloadUrl, true);
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
