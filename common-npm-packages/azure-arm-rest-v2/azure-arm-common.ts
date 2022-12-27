import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import webClient = require("./webClient");
import AzureModels = require("./azureModels");
import constants = require('./constants');
import path = require('path');
import fs = require('fs');
import jwt = require('jsonwebtoken');
import msal = require('@azure/msal-node');
import crypto = require("crypto");
import { Mutex } from 'async-mutex';

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class ApplicationTokenCredentials {
    public baseUrl: string;
    public authorityUrl: string;
    public activeDirectoryResourceId: string;
    public isAzureStackEnvironment: boolean;
    public scheme: number;
    public msiClientId: string;

    private clientId: string;
    private tenantId: string;
    private authType: string;
    private secret?: string;
    private accessToken?: string;
    private certFilePath?: string;
    private isADFSEnabled?: boolean;
    private token_deferred: Q.Promise<string>;
    private useMSAL: boolean;
    private msalInstance: msal.ConfidentialClientApplication;

    private readonly tokenMutex: Mutex;

    constructor(clientId: string, tenantId: string, secret: string, baseUrl: string, authorityUrl: string, activeDirectoryResourceId: string, isAzureStackEnvironment: boolean, scheme?: string, msiClientId?: string, authType?: string, certFilePath?: string, isADFSEnabled?: boolean, access_token?: string, useMSAL?: boolean) {

        if (!Boolean(tenantId) || typeof tenantId.valueOf() !== 'string') {
            throw new Error(tl.loc("DomainCannotBeEmpty"));
        }

        if ((!scheme || scheme === 'ServicePrincipal')) {
            if (!Boolean(clientId) || typeof clientId.valueOf() !== 'string') {
                throw new Error(tl.loc("ClientIdCannotBeEmpty"));
            }

            if (!authType || authType == constants.AzureServicePrinicipalAuthentications.servicePrincipalKey) {
                if (!Boolean(secret) || typeof secret.valueOf() !== 'string') {
                    throw new Error(tl.loc("SecretCannotBeEmpty"));
                }
            }
            else {
                if (!Boolean(certFilePath) || typeof certFilePath.valueOf() !== 'string') {
                    throw new Error(tl.loc("InvalidCertFileProvided"));
                }
            }
        }

        if (!Boolean(baseUrl) || typeof baseUrl.valueOf() !== 'string') {
            throw new Error(tl.loc("armUrlCannotBeEmpty"));
        }

        if (!Boolean(authorityUrl) || typeof authorityUrl.valueOf() !== 'string') {
            throw new Error(tl.loc("authorityUrlCannotBeEmpty"));
        }

        if (!Boolean(activeDirectoryResourceId) || typeof activeDirectoryResourceId.valueOf() !== 'string') {
            throw new Error(tl.loc("activeDirectoryResourceIdUrlCannotBeEmpty"));
        }

        if (!Boolean(isAzureStackEnvironment) || typeof isAzureStackEnvironment.valueOf() != 'boolean') {
            isAzureStackEnvironment = false;
        }

        this.clientId = clientId;
        this.tenantId = tenantId;
        this.baseUrl = baseUrl;
        this.authorityUrl = authorityUrl;
        this.activeDirectoryResourceId = activeDirectoryResourceId;
        this.isAzureStackEnvironment = isAzureStackEnvironment;

        this.scheme = scheme ? AzureModels.Scheme[scheme] : AzureModels.Scheme['ServicePrincipal'];
        this.msiClientId = msiClientId;
        if (this.scheme == AzureModels.Scheme['ServicePrincipal']) {
            this.authType = authType ? authType : constants.AzureServicePrinicipalAuthentications.servicePrincipalKey;
            if (this.authType == constants.AzureServicePrinicipalAuthentications.servicePrincipalKey) {
                this.secret = secret;
            }
            else {
                this.certFilePath = certFilePath;
            }
        }

        this.isADFSEnabled = isADFSEnabled;
        this.accessToken = access_token;

        this.useMSAL = useMSAL;
        this.tokenMutex = new Mutex();
    }

    /**
     * @deprecated ADAL related methods are deprecated and will be removed. 
     * Use Use `getMSALToken(force?: boolean)` instead.
     */
    public static getMSIAuthorizationToken(retyCount: number, timeToWait: number, baseUrl: string, msiClientId?: string): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "GET";
        let apiVersion = "2018-02-01";
        const retryLimit = 5;
        msiClientId = msiClientId ? "&client_id=" + msiClientId : "";
        webRequest.uri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + apiVersion + "&resource=" + baseUrl + msiClientId;
        webRequest.headers = {
            "Metadata": true
        };

        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if (response.statusCode == 429 || response.statusCode == 500) {
                    if (retyCount < retryLimit) {
                        let waitedTime = 2000 + timeToWait * 2;
                        retyCount += 1;
                        setTimeout(() => {
                            deferred.resolve(this.getMSIAuthorizationToken(retyCount, waitedTime, baseUrl, msiClientId));
                        }, waitedTime);
                    }
                    else {
                        deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIStatusCode', response.statusCode, response.statusMessage));
                    }
                }
                else {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIDueToMSINotConfiguredProperlyStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error);
            }
        );

        return deferred.promise;
    }

    public getTenantId(): string {
        return this.tenantId;
    }

    public getClientId(): string {
        return this.clientId;
    }

    public async getToken(force?: boolean): Promise<string> {
        // run exclusively to prevent race conditions
        const release = await this.tokenMutex.acquire();

        try {
            const promisedTokenResult = this.useMSAL ? this.getMSALToken(force) : this.getADALToken(force);
            return await promisedTokenResult;
        } finally {
            // release it for every situation
            release();
        }
    }

    private getMSAL(): msal.ConfidentialClientApplication {
        // use same instance if it already exists
        if (!this.msalInstance) {
            this.msalInstance = this.buildMSAL();
        }

        return this.msalInstance;
    }

    private buildMSAL(): msal.ConfidentialClientApplication {
        // default configuration
        const authorityURL = (new URL(this.tenantId, this.authorityUrl)).toString();

        const msalConfig: msal.Configuration = {
            auth: {
                clientId: this.clientId,
                authority: authorityURL
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel, message, containsPii) {
                        loglevel == msal.LogLevel.Error ? tl.error(message) : tl.debug(message);
                    },
                    piiLoggingEnabled: false,
                    logLevel: msal.LogLevel.Info,
                }
            }
        };

        // proxy usage
        const rawAgentProxyURL: string = tl.getVariable("agent.proxyurl");
        // TODO: bypass will be implemented
        const agentProxyBypassHosts = tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null;
        if(rawAgentProxyURL) {
            tl.debug('MSAL - Proxy will be used.');
            let proxyURL = rawAgentProxyURL;

            const agentProxyUsername: string = tl.getVariable("agent.proxyusername");
            const agentProxyPassword: string = tl.getVariable("agent.proxypassword");
            
            if(agentProxyUsername) {
                const parsedAgentProxyURL = new URL(rawAgentProxyURL);
                proxyURL = `${parsedAgentProxyURL.protocol}//${agentProxyUsername}:${agentProxyPassword}@${parsedAgentProxyURL.host}`;
            }
            
            if(agentProxyUsername) {
                const parsedAgentProxyURL = new URL(rawAgentProxyURL);
                proxyURL = `${parsedAgentProxyURL.protocol}//${agentProxyUsername}:${agentProxyPassword}@${parsedAgentProxyURL.host}`;
            }
            
            tl.debug(`MSAL - Proxy setup is: ${proxyURL}`);
            msalConfig.system.proxyUrl = proxyURL;
        }

        let msalInstance: msal.ConfidentialClientApplication;

        // setup msal according to parameters
        switch (this.scheme) {
            case AzureModels.Scheme.ManagedServiceIdentity:
                msalInstance = this.configureMSALWithMSI(msalConfig);
                break;
            case AzureModels.Scheme.SPN:
            default:
                msalInstance = this.configureMSALWithSP(msalConfig);
                break;
        }

        return msalInstance;
    }

    private configureMSALWithMSI(msalConfig: msal.Configuration): msal.ConfidentialClientApplication {
        let resourceId = this.activeDirectoryResourceId;
        let accessTokenProvider: msal.IAppTokenProvider = (appTokenProviderParameters: msal.AppTokenProviderParameters): Promise<msal.AppTokenProviderResult> => {

            tl.debug("MSAL - ManagedIdentity is used.");

            let providerResultPromise = new Promise<msal.AppTokenProviderResult>(function (resolve, reject) {
                // same for MSAL
                let webRequest = new webClient.WebRequest();
                webRequest.method = "GET";
                let apiVersion = "2018-02-01";
                webRequest.uri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + apiVersion + "&resource=" + resourceId;
                webRequest.headers = {
                    "Metadata": true
                };

                webClient.sendRequest(webRequest).then(
                    (response: webClient.WebResponse) => {
                        if (response.statusCode == 200) {
                            let providerResult: msal.AppTokenProviderResult = {
                                accessToken: response.body.access_token,
                                expiresInSeconds: response.body.expires_in
                            }
                            resolve(providerResult);
                        } else {
                            let errorMessage = tl.loc('CouldNotFetchAccessTokenforMSIStatusCode', response.statusCode, response.statusMessage);
                            reject({ errorCode: response.statusCode, errorMessage: errorMessage });
                        }
                    }, (error) => {
                        reject({ errorCode: "Unkown", errorMessage: error });
                    }
                );
            });

            return providerResultPromise;
        };

        msalConfig.auth.clientSecret = "dummy-value";
        let msalInstance = new msal.ConfidentialClientApplication(msalConfig);
        msalInstance.SetAppTokenProvider(accessTokenProvider);
        return msalInstance;
    }

    private configureMSALWithSP(msalConfig: msal.Configuration): msal.ConfidentialClientApplication {
        switch (this.authType) {
            case constants.AzureServicePrinicipalAuthentications.servicePrincipalKey:
                tl.debug("MSAL - ServicePrincipal - clientSecret is used.");
                msalConfig.auth.clientSecret = this.secret;
                break;
            case constants.AzureServicePrinicipalAuthentications.servicePrincipalCertificate:
                tl.debug("MSAL - ServicePrincipal - certificate is used.");
                try {
                    const certFile = fs.readFileSync(this.certFilePath).toString();

                    // thumbprint
                    const certEncoded = certFile.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]+?)\s*-----END CERTIFICATE-----/i)[1];
                    const certDecoded = Buffer.from(certEncoded, "base64");
                    const thumbprint = crypto.createHash("sha1").update(certDecoded).digest("hex").toUpperCase();

                    // privatekey
                    const privateKey = certFile.match(/-----BEGIN PRIVATE KEY-----\s*([\s\S]+?)\s*-----END PRIVATE KEY-----/i)[0];

                    tl.debug("MSAL - ServicePrincipal - certificate thumbprint creation is successful: " + thumbprint);

                    msalConfig.auth.clientCertificate = {
                        thumbprint: thumbprint,
                        privateKey: privateKey
                    };
                } catch (error) {
                    throw new Error("MSAL - ServicePrincipal - certificate error: " + error);
                }
                break;
        }

        let msalInstance = new msal.ConfidentialClientApplication(msalConfig);
        return msalInstance;
    }

    private async getMSALToken(force?: boolean, retryCount: number = 3, retryWaitMS: number = 2000): Promise<string> {
        tl.debug(`MSAL - getMSALToken called. force=${force}`);

        const request: msal.ClientCredentialRequest = {
            scopes: [this.activeDirectoryResourceId + "/.default"]
        };

        if (force) { this.getMSAL().clearCache(); }

        try {
            const response = await this.getMSAL().acquireTokenByClientCredential(request);
            tl.debug(`MSAL - retrieved token - isFromCache?: ${response.fromCache}`);
            return response.accessToken;
        } catch (error) {
            if (retryCount > 0) {
                tl.debug(`MSAL - retrying getMSALToken - temporary error code: ${error.errorCode}`);
                tl.debug(`MSAL - retrying getMSALToken - remaining attempts: ${retryCount}`);

                await new Promise(r => setTimeout(r, retryWaitMS));
                return await this.getMSALToken(force, (retryCount - 1), retryWaitMS);
            }

            if (error.errorMessage && error.errorMessage.toString().startsWith("7000222")) {
                // additional error message when clientSecret has been expired
                tl.error(tl.loc('ExpiredServicePrincipal'));
            }

            throw new Error(tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', error.errorCode, error.errorMessage));
        }
    }

    /**
     * @deprecated ADAL related methods are deprecated and will be removed. 
     * Use Use `getMSALToken(force?: boolean)` instead.
     */
    private getADALToken(force?: boolean): Q.Promise<string> {
        if (!!this.accessToken && !force) {
            tl.debug("==================== USING ENDPOINT PROVIDED ACCESS TOKEN ====================");
            let deferred = Q.defer<string>();
            deferred.resolve(this.accessToken);
            return deferred.promise;
        }

        if (!this.token_deferred || force) {
            if (this.scheme === AzureModels.Scheme.ManagedServiceIdentity) {
                this.token_deferred = ApplicationTokenCredentials.getMSIAuthorizationToken(0, 0, this.baseUrl, this.msiClientId);
            }
            else {
                this.token_deferred = this._getSPNAuthorizationToken();
            }
        }

        return this.token_deferred;
    }

    /**
     * @deprecated ADAL related methods are deprecated and will be removed. 
     * Use Use `getMSALToken(force?: boolean)` instead.
     */
    private _getSPNAuthorizationToken(): Q.Promise<string> {
        if (this.authType == constants.AzureServicePrinicipalAuthentications.servicePrincipalKey) {
            return this._getSPNAuthorizationTokenFromKey();
        }

        return this._getSPNAuthorizationTokenFromCertificate()
    }

    /**
     * @deprecated ADAL related methods are deprecated and will be removed. 
     * Use Use `getMSALToken(force?: boolean)` instead.
     */
    private _getSPNAuthorizationTokenFromCertificate(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + (this.isADFSEnabled ? "" : this.tenantId) + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this.activeDirectoryResourceId,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_assertion: this._getSPNCertificateAuthorizationToken(),
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        });

        let webRequestOptions: webClient.WebRequestOptions = {
            retriableErrorCodes: null,
            retriableStatusCodes: [400, 408, 409, 500, 502, 503, 504],
            retryCount: null,
            retryIntervalInSeconds: null,
            retryRequestTimedout: null
        };

        webClient.sendRequest(webRequest, webRequestOptions).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if ([400, 401, 403].indexOf(response.statusCode) != -1) {
                    deferred.reject(tl.loc('ExpiredServicePrincipal'));
                }
                else {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );
        return deferred.promise;
    }

    /**
     * @deprecated ADAL related methods are deprecated and will be removed. 
     * Use Use `getMSALToken(force?: boolean)` instead.
     */
    private _getSPNAuthorizationTokenFromKey(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + (this.isADFSEnabled ? "" : this.tenantId) + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this.activeDirectoryResourceId,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_secret: this.secret
        });
        webRequest.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        };

        let webRequestOptions: webClient.WebRequestOptions = {
            retriableErrorCodes: null,
            retriableStatusCodes: [400, 403, 408, 409, 500, 502, 503, 504],
            retryCount: null,
            retryIntervalInSeconds: null,
            retryRequestTimedout: null
        };

        webClient.sendRequest(webRequest, webRequestOptions).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if ([400, 401, 403].indexOf(response.statusCode) != -1) {
                    deferred.reject(tl.loc('ExpiredServicePrincipal'));
                }
                else {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );

        return deferred.promise;
    }

    /**
     * @deprecated ADAL related methods are deprecated and will be removed. 
     * Use Use `getMSALToken(force?: boolean)` instead.
     */
    private _getSPNCertificateAuthorizationToken(): string {
        var openSSLPath = tl.osType().match(/^Win/) ? tl.which(path.join(__dirname, 'openssl', 'openssl')) : tl.which('openssl');
        var openSSLArgsArray = [
            "x509",
            "-sha1",
            "-noout",
            "-in",
            this.certFilePath,
            "-fingerprint"
        ];

        var pemExecutionResult = tl.execSync(openSSLPath, openSSLArgsArray);
        var additionalHeaders = {
            "alg": "RS256",
            "typ": "JWT",
        };

        if (pemExecutionResult.code == 0) {
            tl.debug("FINGERPRINT CREATION SUCCESSFUL");
            let shaFingerprint = pemExecutionResult.stdout;
            let shaFingerPrintHashCode = shaFingerprint.split("=")[1].replace(new RegExp(":", 'g'), "");
            let fingerPrintHashBase64: string = Buffer.from(
                shaFingerPrintHashCode.match(/\w{2}/g).map(function (a) {
                    return String.fromCharCode(parseInt(a, 16));
                }).join(""),
                'binary'
            ).toString('base64');
            additionalHeaders["x5t"] = fingerPrintHashBase64;
        }
        else {
            console.log(pemExecutionResult);
            throw new Error(pemExecutionResult.stderr);
        }

        return getJWT(this.authorityUrl, this.clientId, this.tenantId, this.certFilePath, additionalHeaders, this.isADFSEnabled);
    }
}

/**
 * @deprecated ADAL related methods are deprecated and will be removed. 
 * Use Use `getMSALToken(force?: boolean)` instead.
 */
function getJWT(url: string, clientId: string, tenantId: string, pemFilePath: string, additionalHeaders, isADFSEnabled: boolean) {

    var pemFileContent = fs.readFileSync(pemFilePath);
    var jwtObject = {
        "aud": (`${url}/${!isADFSEnabled ? tenantId : ""}/oauth2/token`).replace(/([^:]\/)\/+/g, "$1"),
        "iss": clientId,
        "sub": clientId,
        "jti": "" + Math.random(),
        "nbf": (Math.floor(Date.now() / 1000) - 1000),
        "exp": (Math.floor(Date.now() / 1000) + 8640000)
    };

    var token = jwt.sign(jwtObject, pemFileContent, { algorithm: 'RS256', header: additionalHeaders });
    return token;
}