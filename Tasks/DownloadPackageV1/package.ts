import { BearerCredentialHandler } from "vso-node-api/handlers/bearertoken";
import { PackageUrlsBuilder } from "./packagebuilder";
import * as vsts from "vso-node-api/WebApi";
import * as vsom from "vso-node-api/VsoClient";
import * as locationUtility from "packaging-common/locationUtilities";
import * as tl from "vsts-task-lib/task";
import { ICoreApi } from "vso-node-api/CoreApi";
var fs = require("fs");
import * as corem from "vso-node-api/CoreApi";
import { TestApi } from "azure-devops-node-api/TestApi";

var path = require("path");

export abstract class Package {
    private packagingAreaName: string = "Packaging";
    private packagingMetadataAreaId: string;

    protected ApiVersion = "3.0-preview.1";
    protected accessToken: string;
    protected credentialHandler: BearerCredentialHandler;
    protected maxRetries: number;
    protected packageProtocolAreaName: string;
    protected packageProtocolAreadId: string;
    protected packageProtocolDownloadAreadId: string;

    constructor(builder: PackageUrlsBuilder) {
        this.accessToken = builder.AccessToken;
        this.credentialHandler = vsts.getBearerHandler(this.accessToken);
        this.maxRetries = builder.MaxRetries;
        this.packageProtocolAreaName = builder.PackageProtocolAreaName;
        this.packageProtocolAreadId = builder.PackageProtocolAreaId;
        this.packageProtocolDownloadAreadId = builder.PackageProtocolDownloadAreadId;
        this.packagingMetadataAreaId = builder.PackagingMetadataAreaId;
    }

    protected abstract async getDownloadUrls(
        collectionUrl: string,
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Array<string>>;

    protected async getUrl(
        vsoClient: vsom.VsoClient,
        areaName: string,
        areaId: string,
        queryParams?: any
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            var getVersioningDataPromise = vsoClient.getVersioningData(this.ApiVersion, areaName, areaId, queryParams);
            getVersioningDataPromise.then(result => {
                console.log("result url " + result.requestUrl);
                return resolve(result.requestUrl);
            });
            getVersioningDataPromise.catch(error => {
                return reject(error);
            });
        });
    }

    protected async getPackageMetadata(connection: vsts.WebApi, queryParams?: any): Promise<any> {
        var metadataUrl = await this.getUrl(
            connection.getCoreApi().vsoClient,
            this.packagingAreaName,
            this.packagingMetadataAreaId,
            queryParams
        );

        var client = connection.getCoreApi().restClient;

        return new Promise((resolve, reject) => {
            client.get(metadataUrl, this.ApiVersion, null, { responseIsCollection: false }, async function(
                error,
                status,
                result
            ) {
                if (!!error || status != 200) {
                    return reject(tl.loc("FailedToGetPackageMetadata", error));
                }
                return resolve(result);
            });
        });
    }

    public async download(
        collectionUrl: string,
        feedId: string,
        packageId: string,
        packageVersion: string,
        downloadPath: string
    ): Promise<void[]> {
        var packagesUrl = await locationUtility.getNuGetUriFromBaseServiceUri(collectionUrl, this.accessToken);
        var packageConnection = new vsts.WebApi(packagesUrl, this.credentialHandler);

        return new Promise<void[]>(async (resolve, reject) => {
            return this.getDownloadUrls(collectionUrl, feedId, packageId, packageVersion)
                .then(downloadUrls => {
                    if (!tl.exist(downloadPath)) {
                        tl.mkdirP(downloadPath);
                    }

                    var zipLocation = path.resolve(downloadPath, "../", packageId) + ".zip";
                    var unzipLocation = path.join(downloadPath, "");
                    console.log("Starting downloading packages " + zipLocation);

                    var promises: Promise<void>[] = [];
                    console.log("downloadurls " + downloadUrls);
                    for (var i = 0; i < downloadUrls.length; i++) {
                        promises.push(
                            this.downloadPackage(packageConnection.getCoreApi(), downloadUrls[i], zipLocation)
                        );
                    }
                    return resolve(Promise.all(promises));
                })
                .catch(error => {
                    return reject(error);
                });
        });
    }

    private async downloadPackage(coreApi: corem.ICoreApi, downloadUrl: string, downloadPath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var accept = coreApi.restClient.createAcceptHeader("application/zip", this.ApiVersion);
            console.log("download url package " + downloadUrl);
            return coreApi.restClient.httpClient.getStream(downloadUrl, accept, async function(error, status, result) {
                var file = fs.createWriteStream(downloadPath);

                tl.debug("Downloading package from url: " + downloadUrl);
                tl.debug("Download status: " + status);
                if (!!error || status != 200) {
                    file.end(null, null, file.close);
                    return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, error));
                }

                result.pipe(file);
                result.on("end", () => {
                    console.log(tl.loc("PackageDownloadSuccessful"));
                    file.end(null, null, file.close);

                    return resolve();
                });
                result.on("error", err => {
                    file.end(null, null, file.close);
                    return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, err));
                });
                return result;
            });
        });
    }


}
