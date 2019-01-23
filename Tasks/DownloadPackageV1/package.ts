import { PackageUrlsBuilder } from "./packagebuilder";
import * as vsts from "vso-node-api/WebApi";
import * as vsom from "vso-node-api/VsoClient";
import * as tl from "vsts-task-lib/task";
import * as corem from "vso-node-api/CoreApi";

var fs = require("fs");
var path = require("path");

export abstract class Package {
    protected maxRetries: number;
    protected packageProtocolAreaName: string;
    protected packageProtocolDownloadAreadId: string;
    protected extension: string;
    protected feedConnection: vsts.WebApi;
    protected pkgsConnection: vsts.WebApi;

    private packagingAreaName: string = "Packaging";
    private packagingMetadataAreaId: string;
    private contentHeader: string;
    private ApiVersion = "3.0-preview.1";

    constructor(builder: PackageUrlsBuilder) {
        this.maxRetries = builder.MaxRetries;
        this.packageProtocolAreaName = builder.PackageProtocolAreaName;
        this.packageProtocolDownloadAreadId = builder.PackageProtocolDownloadAreadId;
        this.packagingMetadataAreaId = builder.PackagingMetadataAreaId;
        this.extension = builder.Extension;
        this.contentHeader = builder.ContentHeader;
        this.feedConnection = builder.FeedsConnection;
        this.pkgsConnection = builder.PkgsConnection;
    }

    protected abstract async getDownloadUrls(
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, string>>;


    // TODO remove this?
    protected async getUrl(
        vsoClient: vsom.VsoClient,
        areaName: string,
        areaId: string,
        routeValues: any,
        queryParams?: any
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            var getVersioningDataPromise = vsoClient.getVersioningData(
                null,
                areaName,
                areaId,
                routeValues,
                queryParams
            );
            getVersioningDataPromise.then(result => {
                console.log("result url " + result.requestUrl);
                return resolve(result.requestUrl);
            });
            getVersioningDataPromise.catch(error => {
                console.log("result url " + JSON.stringify(error));

                return reject(error);
            });
        });
    }

    protected async getPackageMetadata(connection: vsts.WebApi, routeValues: any, queryParams?: any): Promise<any> {
        var metadataUrl = await this.getUrl(
            connection.getCoreApi().vsoClient,
            this.packagingAreaName,
            this.packagingMetadataAreaId,
            routeValues,
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
        feedId: string,
        packageId: string,
        packageVersion: string,
        downloadPath: string
    ): Promise<void[]> {
        return new Promise<void[]>(async (resolve, reject) => {
            return this.getDownloadUrls(feedId, packageId, packageVersion)
                .then(downloadUrls => {
                    if (!tl.exist(downloadPath)) {
                        tl.mkdirP(downloadPath);
                    }

                    var promises: Promise<void>[] = [];
                    console.log("downloadurls " + JSON.stringify(downloadUrls));

                    Object.keys(downloadUrls).map(fileName => {
                        var zipLocation = path.resolve(downloadPath, "../", fileName);
                        //var unzipLocation = path.join(downloadPath, "");
                        console.log("hello");
                        promises.push(
                            this.downloadPackage(this.pkgsConnection.getCoreApi(), downloadUrls[fileName], zipLocation)
                        );
                    });

                    return resolve(Promise.all(promises));
                })
                .catch(error => {
                    return reject(error);
                });
        });
    }

    private async downloadPackage(coreApi: corem.ICoreApi, downloadUrl: string, downloadPath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var accept = coreApi.restClient.createAcceptHeader(this.contentHeader, this.ApiVersion);
            console.log("download url package " + downloadUrl);
            return coreApi.restClient.httpClient.getStream(downloadUrl, accept, async function(error, status, result) {
                var file = fs.createWriteStream(downloadPath);

                tl.debug("Downloading package from url: " + downloadUrl);
                tl.debug("Download status: " + status);
                if (!!error || status != 200) {
                    console.log(
                        "error bad status " + JSON.stringify(error) + " status " + status + " result " + result
                    );
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
                    console.log("error file close " + JSON.stringify(err));

                    file.end(null, null, file.close);
                    return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, err));
                });
                return result;
            });
        });
    }
}
