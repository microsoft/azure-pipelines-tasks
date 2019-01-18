import { BearerCredentialHandler } from "vso-node-api/handlers/bearertoken";
import { PackageUrlsBuilder } from "./packagebuilder";
import * as vsts from "vso-node-api/WebApi";
import * as vsom from 'vso-node-api/VsoClient';
import * as locationUtility from "packaging-common/locationUtilities";
import * as tl from 'vsts-task-lib/task';
import { ICoreApi } from "vso-node-api/CoreApi";

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

    abstract async getDownloadUrls(
        collectionUrl: string,
        feedId: string,
        packageId: string,
        packageVersion: string
    ): Promise<string[]>;

    private async getUrl(vsoClient: vsom.VsoClient, areaName: string, areaId: string, queryParams?: any): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            var getVersioningDataPromise = vsoClient.getVersioningData(this.ApiVersion, areaName, areaId, queryParams);
            getVersioningDataPromise.then((result) => {
                console.log("result url " + result.requestUrl);
                return resolve(result.requestUrl); 
            });
            getVersioningDataPromise.catch((error) => {
                return reject(error)
            });
        });
    }

    protected async getPackageMetadata(connection: vsts.WebApi, queryParams?: any): Promise<any> {

        var metadataUrl = await this.getUrl(connection.getCoreApi().vsoClient, this.packagingAreaName, this.packagingMetadataAreaId, queryParams);

        return new Promise((resolve, reject) => {
            connection.getCoreApi().restClient.get(metadataUrl, this.ApiVersion, null, { responseIsCollection: false }, async function (error, status, result) {
                if (!!error || status != 200) {
                    return reject(tl.loc("FailedToGetPackageMetadata", error));
                }
                return resolve(result);
            });
        });
    }

}
