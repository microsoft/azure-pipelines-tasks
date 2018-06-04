// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import vsom = require('./VsoClient');
import VsoBaseInterfaces = require('./interfaces/common/VsoBaseInterfaces');
import serm = require('./Serialization');
import * as rm from 'artifact-engine/Providers/typed-rest-client/RestClient';
import * as hm from 'artifact-engine/Providers/typed-rest-client/HttpClient';

export class ClientApiBase {
    baseUrl: string;
    userAgent: string;
    http: hm.HttpClient;
    rest: rm.RestClient;

    vsoClient: vsom.VsoClient;

    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], userAgent?: string, options?: VsoBaseInterfaces.IRequestOptions);

    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], userAgent: string, options?: VsoBaseInterfaces.IRequestOptions) {
        this.baseUrl = baseUrl;

        this.http = new hm.HttpClient(userAgent, handlers, options);
        this.rest = new rm.RestClient(userAgent, null, handlers, options);

        this.vsoClient = new vsom.VsoClient(baseUrl, this.rest);
        this.userAgent = userAgent;
    }

    public createAcceptHeader(type: string, apiVersion?: string): string {
        return type + (apiVersion ? (';api-version=' + apiVersion) : '');
    }

    public createRequestOptions(type: string, apiVersion?: string) {
        let options: rm.IRequestOptions = <rm.IRequestOptions>{};
        options.acceptHeader = this.createAcceptHeader(type, apiVersion);
        return options;
    }

    public formatResponse(data: any, responseTypeMetadata: any, isCollection: boolean): any {
        let serializationData = {
            responseTypeMetadata: responseTypeMetadata,
            responseIsCollection: isCollection
        };
        let deserializedResult = serm.ContractSerializer.deserialize(data,
            serializationData.responseTypeMetadata,
            false,
            serializationData.responseIsCollection);
        return deserializedResult;
    }
}