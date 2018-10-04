import * as interfaces from 'vso-node-api/interfaces/common/VSSInterfaces';
import * as tl from 'vsts-task-lib/task';
import * as VsoBaseInterfaces from 'vso-node-api/interfaces/common/VsoBaseInterfaces';
import * as locutil from './locationUtilities';
import { ClientVersioningData } from 'vso-node-api/VsoClient';
import { ICoreApi } from 'vso-node-api/CoreApi';
import vstsClientBases = require("vso-node-api/ClientApiBases");
// import {WebApi} from 'vso-node-api/WebApi';

import * as restclient from 'typed-rest-client/RestClient';

export interface SessionRequest {
    feed: string;
    source: string;
    data: { [key: string] : string; };
}

export interface SessionResponse {
    sessionId: string
}

export class ProvenanceApi extends vstsClientBases.ClientApiBase {

   /* constructor(webApi: WebApi) {
        super(webApi.serverUrl, [webApi.authHandler], "vsts-packageprovenance-api", webApi.options)
    } */

    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], options?: VsoBaseInterfaces.IRequestOptions) {
        super(baseUrl, handlers, "vsts-packageprovenance-api", options);
    }

    /**
     * Create Provenance Session
     * 
     * @param {string} protocol - the protocol (npm, nuget, etc) to create a session for
     * @param {SessionRequest} sessionRequest - the data about the session.
     */

    public async createSession(
        protocol: string,
        sessionRequest: SessionRequest,
        ): Promise<SessionResponse> {

        return new Promise<SessionResponse>(async (resolve, reject) => {

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

                let res: restclient.IRestResponse<SessionResponse>;
                res = await this.rest.create<SessionResponse>(url, sessionRequest, options);
                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
            }
            catch (err) {
                reject(err);
            }
        });
    }
}

