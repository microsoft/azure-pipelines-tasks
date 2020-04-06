import * as fs from 'fs';
import * as stream from 'stream';
import * as util from 'util';

import * as tl from 'azure-pipelines-task-lib/task';

import { PackageFile } from './packagefile';
import { PackageUrlsBuilder } from './packagebuilder';
import { WebApi } from 'azure-devops-node-api';
import { VsoClient } from 'azure-devops-node-api/VsoClient';
import { ICoreApi } from 'azure-devops-node-api/CoreApi';

export class PackageFileResult {
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
    protected packageProtocolAreaName: string;
    protected packageProtocolDownloadAreadId: string;
    protected extension: string;
    protected feedConnection: WebApi;
    protected pkgsConnection: WebApi;

    private executeWithRetries: <T>(operation: () => Promise<T>) => Promise<T>;
    private packagingAreaName: string = 'Packaging';
    private getPackagesAreaId: string = '7a20d846-c929-4acc-9ea2-0d5a7df1b197';
    private packagingMetadataAreaId: string;

    constructor(builder: PackageUrlsBuilder) {
        this.packageProtocolAreaName = builder.PackageProtocolAreaName;
        this.packageProtocolDownloadAreadId = builder.PackageProtocolDownloadAreadId;
        this.packagingMetadataAreaId = builder.PackagingMetadataAreaId;
        this.extension = builder.Extension;
        this.feedConnection = builder.FeedsConnection;
        this.pkgsConnection = builder.PkgsConnection;
        this.executeWithRetries = builder.ExecuteWithRetries;
    }

    protected abstract async getDownloadUrls(
        feedId: string,
        project: string,
        packageId: string,
        packageVersion: string
    ): Promise<Map<string, PackageFileResult>>;

    protected async getUrl(
        vsoClient: VsoClient,
        areaName: string,
        areaId: string,
        routeValues: any,
        queryParams?: any
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const getVersioningDataPromise = this.executeWithRetries(() =>
                vsoClient.getVersioningData(null, areaName, areaId, routeValues, queryParams)
            );

            getVersioningDataPromise.then(result => {
                tl.debug('Got URL ' + result.requestUrl + ' from versioning data.');
                return resolve(result.requestUrl);
            });
            getVersioningDataPromise.catch(error => {
                tl.debug('Getting URL from versioning data failed with error: ' + error);
                return reject(error);
            });
        });
    }

    protected async getPackageMetadata(connection: WebApi, routeValues: any, queryParams?: any, areaId?: string): Promise<any> {
        const metadataUrl = await this.getUrl(
            connection.vsoClient,
            this.packagingAreaName,
            areaId || this.packagingMetadataAreaId,
            routeValues,
            queryParams
        );

        const client = connection.rest;

        return new Promise((resolve, reject) => {
            this.executeWithRetries(() =>
                client.get(metadataUrl).then(response => {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        return resolve(response.result);
                    } else {
                        throw new Error(response.statusCode + ': ' + response.result);
                    }
                })
            ).catch(error => {
                tl.debug('Getting package metadata failed with error: ' + error);
                return reject(tl.loc('FailedToGetPackageMetadata', metadataUrl, error));
            });
        });
    }

    public async resolvePackageId(
        feedId: string,
        project: string,
        packageName: string
    ): Promise<string> {
        const routeValues = {
            feedId: feedId,
            project: project
        };
        const queryParams = {
            packageNameQuery: packageName,
            protocolType: this.packageProtocolAreaName
        };

        return new Promise<string>(async (resolve, reject) => {
            this.getPackageMetadata(this.feedConnection, routeValues, queryParams, this.getPackagesAreaId)
            .then(packages => {
                tl.debug('Found ' + packages['count'] + ' packages matching search pattern ' + packageName);
                for (let i = 0; i < packages['count']; i++) {
                    if (packages['value'][i]['name'] === packageName) {
                        return resolve(packages['value'][i]['id']);
                    }
                }
                return reject('Package with name ' + packageName + ' not found.');
            }).catch(error => {
                tl.debug('Package with name ' + packageName + ' not found: ' + error);
                return reject(error);
            });
        });
    }

    public async download(
        feedId: string,
        project: string,
        packageId: string,
        packageVersion: string,
        downloadPath: string,
        extract: boolean
    ): Promise<PackageFile[]> {
        const downloadUrls = await this.getDownloadUrls(feedId, project, packageId, packageVersion);

        if (!tl.exist(downloadPath)) {
            tl.mkdirP(downloadPath);
        }

        const coreApi = await this.pkgsConnection.getCoreApi();
        const packageFiles = Object.keys(downloadUrls).map(fileName => new PackageFile(extract, downloadPath, fileName, downloadUrls[fileName]));

        await Promise.all(packageFiles.map(async packageFile => {
            tl.rmRF(packageFile.downloadPath);
            await this.placePackageFile(packageFile, coreApi);
        }));

        return packageFiles;
    }

    private async placePackageFile(packageFile: PackageFile, coreApi: ICoreApi) : Promise<void> {
        if (packageFile.source.IsUrl) {
            await this.downloadFile(packageFile.downloadPath, coreApi, packageFile.source.Value);
        } else {
            await this.writeFileFromString(packageFile.downloadPath, packageFile.source.Value);
        }
    }

    private async writeFileFromString(filePath: string, content: string): Promise<void> {
        try {
            tl.debug(`Writing file ${filePath}`)
            await util.promisify(fs.writeFile)(filePath, content);
        } catch (err) {
            tl.debug('Writing file content failed with error: ' + err);
            throw err;
        }
    }

    private async downloadFile(
        filePath: string,
        coreApi: ICoreApi,
        downloadUrl: string
    ): Promise<void> {
        return await this.executeWithRetries(async () => {
            try {
                const response = await coreApi.http.get(downloadUrl);

                if (response.message.statusCode < 200 || response.message.statusCode >= 300) {
                    throw new Error(response.message.statusCode + ': ' + response.message.statusMessage);
                }

                await util.promisify(stream.pipeline)(
                    response.message as stream.Readable,
                    fs.createWriteStream(filePath));

                console.log(tl.loc('PackageDownloadSuccessful', filePath, downloadUrl));

            } catch (error) {
                tl.debug('Downloading file failed with error: ' + error);
                throw new Error(tl.loc('FailedToDownloadPackage', downloadUrl, error));
            }
        });
    }
}
