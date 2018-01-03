// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import VsoBaseInterfaces = require('./interfaces/common/VsoBaseInterfaces');
import basem = require('./ClientApiBases');
import buildm = require('./BuildApi');
import corem = require('./CoreApi');
import basicm = require('./handlers/basiccreds');
import bearm = require('./handlers/bearertoken');
import patm = require('./handlers/personalaccesstoken');

import * as rm from 'artifact-engine/Providers/typed-rest-client/RestClient';
import vsom = require('./VsoClient');
import lim = require("./interfaces/LocationsInterfaces");

import fs = require('fs');
import crypto = require('crypto');

/**
 * Methods to return handler objects (see handlers folder)
 */

export function getBasicHandler(username: string, password: string): VsoBaseInterfaces.IRequestHandler {
    return new basicm.BasicCredentialHandler(username, password);
}

export function getBearerHandler(token: string): VsoBaseInterfaces.IRequestHandler {
    return new bearm.BearerCredentialHandler(token);
}

export function getPersonalAccessTokenHandler(token: string): VsoBaseInterfaces.IRequestHandler {
    return new patm.PersonalAccessTokenCredentialHandler(token);
}

export function getHandlerFromToken(token: string): VsoBaseInterfaces.IRequestHandler {
    if (token.length === 52) {
        return getPersonalAccessTokenHandler(token);
    }
    else {
        return getBearerHandler(token);
    }
}

// ---------------------------------------------------------------------------
// Factory to return client apis
// When new APIs are added, a method must be added here to instantiate the API
//----------------------------------------------------------------------------
export class WebApi {

    serverUrl: string;
    authHandler: VsoBaseInterfaces.IRequestHandler;
    rest: rm.RestClient;
    vsoClient: vsom.VsoClient;
    options: VsoBaseInterfaces.IRequestOptions;

    /*
     * Factory to return client apis and handlers
     * @param defaultUrl default server url to use when creating new apis from factory methods
     * @param authHandler default authentication credentials to use when creating new apis from factory methods
     */
    constructor(defaultUrl: string, authHandler: VsoBaseInterfaces.IRequestHandler, options?: VsoBaseInterfaces.IRequestOptions) {
        this.serverUrl = defaultUrl;
        this.authHandler = authHandler;
        this.options = options || {};

        // try get proxy setting from environment variable set by VSTS-Task-Lib if there is no proxy setting in the options
        if (!this.options.proxy || !this.options.proxy.proxyUrl) {
            if (global['_vsts_task_lib_proxy']) {
                let proxyFromEnv: VsoBaseInterfaces.IProxyConfiguration = {
                    proxyUrl: global['_vsts_task_lib_proxy_url'],
                    proxyUsername: global['_vsts_task_lib_proxy_username'],
                    proxyPassword: this._readTaskLibSecrets(global['_vsts_task_lib_proxy_password']),
                    proxyBypassHosts: JSON.parse(global['_vsts_task_lib_proxy_bypass'] || "[]"),
                };

                this.options.proxy = proxyFromEnv;
            }
        }

        // try get cert setting from environment variable set by VSTS-Task-Lib if there is no cert setting in the options
        if (!this.options.cert) {
            if (global['_vsts_task_lib_cert']) {
                let certFromEnv: VsoBaseInterfaces.ICertConfiguration = {
                    caFile: global['_vsts_task_lib_cert_ca'],
                    certFile: global['_vsts_task_lib_cert_clientcert'],
                    keyFile: global['_vsts_task_lib_cert_key'],
                    passphrase: this._readTaskLibSecrets(global['_vsts_task_lib_cert_passphrase']),
                };

                this.options.cert = certFromEnv;
            }
        }

        // try get ignore SSL error setting from environment variable set by VSTS-Task-Lib if there is no ignore SSL error setting in the options
        if (!this.options.ignoreSslError) {
            this.options.ignoreSslError = !!global['_vsts_task_lib_skip_cert_validation'];
        }

        this.rest = new rm.RestClient('vsts-node-api', null, [this.authHandler], this.options);
        this.vsoClient = new vsom.VsoClient(defaultUrl, this.rest);
    }

    /**
     *  Convenience factory to create with a bearer token.
     * @param defaultServerUrl default server url to use when creating new apis from factory methods
     * @param defaultAuthHandler default authentication credentials to use when creating new apis from factory methods
     */
    public static createWithBearerToken(defaultUrl: string, token: string, options?: VsoBaseInterfaces.IRequestOptions) {
        let bearerHandler = getBearerHandler(token);
        return new this(defaultUrl, bearerHandler, options);
    }

    public async connect(): Promise<lim.ConnectionData> {
        return new Promise<lim.ConnectionData>(async (resolve, reject) => {
            try {
                let res: rm.IRestResponse<lim.ConnectionData>;
                res = await this.rest.get<lim.ConnectionData>(this.vsoClient.resolveUrl('/_apis/connectionData'));
                resolve(res.result);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Each factory method can take a serverUrl and a list of handlers
     * if these aren't provided, the default url and auth handler given to the constructor for this class will be used
     */
    public getBuildApi(serverUrl?: string, handlers?: VsoBaseInterfaces.IRequestHandler[]): buildm.IBuildApi {
        serverUrl = serverUrl || this.serverUrl;
        handlers = handlers || [this.authHandler];
        return new buildm.BuildApi(serverUrl, handlers, this.options);
    }

    private _readTaskLibSecrets(lookupKey: string): string {
        // the lookupKey should has following format
        // base64encoded<keyFilePath>:base64encoded<encryptedContent>
        if (lookupKey && lookupKey.indexOf(':') > 0) {
            let lookupInfo: string[] = lookupKey.split(':', 2);

            // file contains encryption key
            let keyFile = new Buffer(lookupInfo[0], 'base64').toString('utf8');
            let encryptKey = new Buffer(fs.readFileSync(keyFile, 'utf8'), 'base64');

            let encryptedContent: string = new Buffer(lookupInfo[1], 'base64').toString('utf8');

            let decipher = crypto.createDecipher("aes-256-ctr", encryptKey)
            let decryptedContent = decipher.update(encryptedContent, 'hex', 'utf8')
            decryptedContent += decipher.final('utf8');

            return decryptedContent;
        }
    }
}
