import { PackageUrlsBuilder } from "./packagebuilder";
import * as vsts from "vso-node-api/WebApi";
import * as vsom from "vso-node-api/VsoClient";
import * as tl from "vsts-task-lib/task";
import * as corem from "vso-node-api/CoreApi";
import { IncomingMessage } from "http";
import { stringify } from "ltx";
import { Extractor } from "./extractor";
import { unzip } from "zlib";
var https = require("https");
var fs = require("fs");
var path = require("path");
import downloadutility = require("utility-common/downloadutility");

export class Result {
    private value: string;
    private isUrl: boolean;

    get Value() {
        return this.value;
    }
    get IsUrl() {
        return this.isUrl;
    }

    constructor(value: string, isUrl: boolean) {
        this.value = value;
        this.isUrl = isUrl;
    }
}

export abstract class Package {
    protected maxRetries: number;
    protected packageProtocolAreaName: string;
    protected packageProtocolDownloadAreadId: string;
    protected extension: string;
    protected feedConnection: vsts.WebApi;
    protected pkgsConnection: vsts.WebApi;

    private packagingAreaName: string = "Packaging";
    private packagingMetadataAreaId: string;
    private downloadFile: (
        coreApi: corem.ICoreApi,
        downloadUrl: string,
        downloadPath: string,
        unzipLocation: string
    ) => Promise<Extractor>;

    constructor(builder: PackageUrlsBuilder) {
        this.maxRetries = builder.MaxRetries;
        this.packageProtocolAreaName = builder.PackageProtocolAreaName;
        this.packageProtocolDownloadAreadId = builder.PackageProtocolDownloadAreadId;
        this.packagingMetadataAreaId = builder.PackagingMetadataAreaId;
        this.extension = builder.Extension;
        this.feedConnection = builder.FeedsConnection;
        this.pkgsConnection = builder.PkgsConnection;
        if (builder.BlobStoreRedirectEnabled) {
            console.log("Redirect enabled");
            this.downloadFile = this.downloadFileThroughBlobstore;
        } else {
            console.log("Redirect disabled");
            this.downloadFile = this.downloadFileDirect;
        }
    }

    protected abstract async getDownloadUrls(
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, Result>>;

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
            client.get(metadataUrl, null, null, { responseIsCollection: false }, async function(error, status, result) {
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
    ): Promise<Extractor[]> {
        return new Promise<Extractor[]>(async (resolve, reject) => {
            return this.getDownloadUrls(feedId, packageId, packageVersion)
                .then(downloadUrls => {
                    if (!tl.exist(downloadPath)) {
                        tl.mkdirP(downloadPath);
                    }

                    var promises: Promise<Extractor>[] = [];
                    console.log("downloadurls " + JSON.stringify(downloadUrls));

                    Object.keys(downloadUrls).map(fileName => {
                        var zipLocation = path.resolve(downloadPath, "../", fileName);
                        var unzipLocation = path.join(downloadPath, "");
                        promises.push(
                            downloadUrls[fileName].IsUrl
                                ? this.downloadFile(
                                      this.pkgsConnection.getCoreApi(),
                                      downloadUrls[fileName].Value,
                                      zipLocation,
                                      unzipLocation
                                  )
                                : this.writeFile(downloadUrls[fileName].Value, zipLocation, unzipLocation)
                        );
                    });

                    return resolve(Promise.all(promises));
                })
                .catch(error => {
                    return reject(error);
                });
        });
    }

    private async writeFile(content: string, filePath: string, unzipLocation: string): Promise<Extractor> {
        return new Promise<Extractor>((resolve, reject) => {
            fs.writeFile(filePath, content, err => {
                if (err) {
                    return reject(err);
                } else {
                    return resolve(new Extractor(filePath, unzipLocation));
                }
            });
        });
    }


    // TODO Remove this once redirect based download is implemented
    private async downloadFileDirect(
        coreApi: corem.ICoreApi,
        downloadUrl: string,
        downloadPath: string,
        unzipLocation: string
    ): Promise<Extractor> {
        return new Promise<Extractor>((resolve, reject) => {
            console.log("download url package " + downloadUrl);
            return coreApi.restClient.httpClient.getStream(downloadUrl, null, function(error, status, result) {
                var file = fs.createWriteStream(downloadPath);

                tl.debug("Downloading package from url: " + downloadUrl);
                tl.debug("Download status: " + status);
                if (!!error || status != 200) {
                    console.log(
                        "error bad status " + JSON.stringify(error) + " status " + status + " result " + result
                    );
                    file.close();
                    return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, error));
                }

                result.pipe(
                    file,
                    { end: true }
                );
                result.on("end", () => {
                    console.log(tl.loc("PackageDownloadSuccessful"));
                    file.on("close", () => {
                        var extractor = new Extractor(downloadPath, unzipLocation);
                        return resolve(extractor);
                    });
                });
                result.on("error", err => {
                    console.log("error file close " + JSON.stringify(err));
                    return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, err));
                });
            });
        });
    }

    private async downloadFileThroughBlobstore(
        coreApi: corem.ICoreApi,
        downloadUrl: string,
        downloadPath: string,
        unzipLocation: string
    ): Promise<Extractor> {
        return new Promise<Extractor>((resolve, reject) => {
            console.log("Download Url Package " + downloadUrl);
            coreApi.restClient.httpClient.get("GET", downloadUrl, {}, async function(res: IncomingMessage) {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers && res.headers.location) {
                    console.log("Redirect URL " + res.headers.location);
                    var redirectUrl = encodeURI(decodeURIComponent(res.headers.location));
                    console.log("Correct redirect URL " + redirectUrl);

                    downloadutility
                        .download(redirectUrl, downloadPath, false, false)
                        .then(() => {
                            return resolve(new Extractor(downloadPath, unzipLocation));
                        })
                        .catch(error => {
                            return reject(error);
                        });
                } else {
                    return reject("Unable to get redirect URL. Status: " + status);
                }
            });
        });
    }
}
