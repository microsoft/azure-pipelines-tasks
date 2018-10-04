import * as vsts from 'vso-node-api';
import * as interfaces from 'vso-node-api/interfaces/common/VSSInterfaces';
import * as tl from 'vsts-task-lib/task';
import * as VsoBaseInterfaces from 'vso-node-api/interfaces/common/VsoBaseInterfaces';
import * as locutil from './locationUtilities';
import { ClientVersioningData } from 'vso-node-api/VsoClient';
import { ICoreApi } from 'vso-node-api/CoreApi';
import vstsClientBases = require("vso-node-api/ClientApiBases");

import * as restclient from 'typed-rest-client/RestClient';

export class ProvenanceApi extends vstsClientBases.ClientApiBase {
    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], options?: VsoBaseInterfaces.IRequestOptions) {
        super(baseUrl, handlers, "vsts-packageprovenance-api", options);
    }

    /**
     * Create Provenance Session
     * 
     * @param {string} feedId - the feed to create a session for
     * @param {string} protocol - the protocol (npm, nuget, etc) to create a session for
     * @param {number} buildId - The ID of the build.
     */

    public async createSession(
        feedId: string,
        protocol: string,
        buildId: number,
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {

            let routeValues: any = {
                protocol: protocol
            };

            try {
                let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
                    "5.0-preview.1",
                    "Provenance",
                    "503B4E54-EBF4-4D04-8EEE-21C00823C2AC",
                    routeValues);

                let url: string = verData.requestUrl;

                let options: restclient.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restclient.IRestResponse<string[]>;
                res = await this.rest.create<string[]>(url, feedId, options);
                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
            }
            catch (err) {
                reject(err);
            }
        });
    }
}

export async function getProvenanceSessionUrl(packagingUrl: string, protocol: string): Promise<string> {
    const apiVersion = '5.0-preview.1';
    const area = 'Provenance';
    const locationId = '503B4E54-EBF4-4D04-8EEE-21C00823C2AC';

    const accessToken = locutil.getSystemAccessToken();
    const credentialHandler = vsts.getBearerHandler(accessToken);
    const vssConnection = new vsts.WebApi(packagingUrl, credentialHandler);
    const coreApi: ICoreApi = await vssConnection.getCoreApi();

    const routeValues: any = {
        protocol: protocol
    };

    const data: ClientVersioningData = await locutil.Retry(async () => {
        return await coreApi.vsoClient.getVersioningData(
            apiVersion,
            area,
            locationId,
            routeValues);
    }, 4, 100);

    return data.requestUrl;
}

