var fs = require("fs");
var path = require("path");

import * as tl from "vsts-task-lib/task";

import { Extractor } from "./extractor";
import { PackageUrlsBuilder } from "./packagebuilder";
import { WebApi } from "azure-devops-node-api";
import { VsoClient } from "azure-devops-node-api/VsoClient";
import { ICoreApi } from "azure-devops-node-api/CoreApi";
import stream = require("stream");

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
    protected feedConnection: WebApi;
    protected pkgsConnection: WebApi;

    private packagingAreaName: string = "Packaging";
    private packagingMetadataAreaId: string;

    constructor(builder: PackageUrlsBuilder) {
        this.maxRetries = builder.MaxRetries;
        this.packageProtocolAreaName = builder.PackageProtocolAreaName;
        this.packageProtocolDownloadAreadId = builder.PackageProtocolDownloadAreadId;
        this.packagingMetadataAreaId = builder.PackagingMetadataAreaId;
        this.extension = builder.Extension;
        this.feedConnection = builder.FeedsConnection;
        this.pkgsConnection = builder.PkgsConnection;
    }

    protected abstract async getDownloadUrls(
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, Result>>;

    protected async getUrl(
        vsoClient: VsoClient,
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
                tl.debug("result " + result);
                return resolve(result.requestUrl);
            });
            getVersioningDataPromise.catch(error => {
                tl.debug("result " + error);

                return reject(error);
            });
        });
    }

    protected async getPackageMetadata(connection: WebApi, routeValues: any, queryParams?: any): Promise<any> {
        var metadataUrl = await this.getUrl(
            connection.vsoClient,
            this.packagingAreaName,
            this.packagingMetadataAreaId,
            routeValues,
            queryParams
        );
        tl.debug("result " + metadataUrl);

        var client = connection.rest;

        return new Promise((resolve, reject) => {
            client
                .get(metadataUrl)
                .then(response => {
                    return resolve(response.result);
                })
                .catch(error => {
                    return reject(tl.loc("FailedToGetPackageMetadata", error));
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
                .then(async downloadUrls => {
                    if (!tl.exist(downloadPath)) {
                        tl.mkdirP(downloadPath);
                    }
                    var promises: Promise<Extractor>[] = [];
                    var coreApi = await this.pkgsConnection.getCoreApi();
                    Object.keys(downloadUrls).map(fileName => {

                        var zipLocation = path.resolve(downloadPath, "../", fileName);
                        var unzipLocation = path.join(downloadPath, "");

                        promises.push(
                            downloadUrls[fileName].IsUrl
                                ? this.downloadFile(coreApi, downloadUrls[fileName].Value, zipLocation, unzipLocation)
                                : this.writeFile(downloadUrls[fileName].Value, zipLocation, unzipLocation)
                        );
                    });

                    return resolve(Promise.all(promises));
                })
                .catch(error => {
                    tl.debug("error " + error);
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

    private async downloadFile(
        coreApi: ICoreApi,
        downloadUrl: string,
        downloadPath: string,
        unzipLocation: string
    ): Promise<Extractor> {
        return new Promise<Extractor>((resolve, reject) => {
            return coreApi.http.get(downloadUrl).then(response => {

                var responseStream = response.message as stream.Readable;
                var file = fs.createWriteStream(downloadPath);
                console.log("hello" + file);
                responseStream.pipe(file);
                console.log("hello2" + file);

                responseStream.on("end", () => {
                    console.log(tl.loc("PackageDownloadSuccessful"));
                    file.on("close", () => {
                        console.log("hellfdo");
                        var extractor = new Extractor(downloadPath, unzipLocation);
                        return resolve(extractor);
                    });
                });
                responseStream.on("error", err => {
                    console.log("error file close " + JSON.stringify(err));
                    return reject(tl.loc("FailedToDownloadPackage", downloadUrl, err));
                });
            }).catch(error => {
                console.log("rejsadf " + error);
                return reject(tl.loc("FailedToDownloadPackage", downloadUrl, error));
            });
        });
    }

}
