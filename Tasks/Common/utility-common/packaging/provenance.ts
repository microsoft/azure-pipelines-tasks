import * as VsoBaseInterfaces from 'vso-node-api/interfaces/common/VsoBaseInterfaces';
import { ClientVersioningData } from 'vso-node-api/VsoClient';
import vstsClientBases = require("vso-node-api/ClientApiBases");

import * as restclient from 'typed-rest-client/RestClient';

export interface SessionRequest {
    /**
     * Generic property bag to store data about the session
     */
    data: { [key: string] : string; };
    /**
     * The feed name or id for the session
     */
    feed: string;
    /**
     * The type of session If a known value is provided, the Data dictionary will be validated for the presence of properties required by that type
     */
    source: string;
}

export interface SessionResponse {
    /**
     * The identifier for the session
     */
    sessionId: string;
}


export class ProvenanceApi extends vstsClientBases.ClientApiBase {
    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], options?: VsoBaseInterfaces.IRequestOptions) {
        super(baseUrl, handlers, "node-packageprovenance-api", options);
    }

    /**
     * Creates a session, a wrapper around a feed that can store additional metadata on the packages published to the session.
     * 
     * @param {SessionRequest} sessionRequest - The feed and metadata for the session
     * @param {string} protocol - The protocol that the session will target
     */
    public async createSession(
        sessionRequest: SessionRequest,
        protocol: string
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

