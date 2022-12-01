import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import webClient = require("./webClient");
import AzureModels = require("./azureModels");
import constants = require('./constants');
import path = require('path');
import fs = require('fs');
var jwt = require('jsonwebtoken');

export class ApplicationTokenCredentials {
    private clientId: string;
    private domain: string;
    private authType: string;
    private secret?: string;
    private certFilePath?: string;
    private isADFSEnabled?: boolean;
    public baseUrl: string;
    public authorityUrl: string;
    public activeDirectoryResourceId: string;
    public isAzureStackEnvironment: boolean;
    public scheme: number;
    public msiClientId: string;
    private token_deferred: Q.Promise<string>;

    constructor(clientId: string, domain: string, secret: string, baseUrl: string, authorityUrl: string, activeDirectoryResourceId: string, isAzureStackEnvironment: boolean, scheme?: string, msiClientId?: string, authType?: string, certFilePath?: string, isADFSEnabled?: boolean) {

        if (!Boolean(domain) || typeof domain.valueOf() !== 'string') {
            throw new Error(tl.loc("DomainCannotBeEmpty"));
        }

        if((!scheme ||scheme ==='ServicePrincipal')){
            if (!Boolean(clientId) || typeof clientId.valueOf() !== 'string') {
                throw new Error(tl.loc("ClientIdCannotBeEmpty"));
            }
    
            if(!authType || authType == constants.AzureServicePrinicipalAuthentications.servicePrincipalKey) {
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

        if(!Boolean(isAzureStackEnvironment) || typeof isAzureStackEnvironment.valueOf() != 'boolean') {
            isAzureStackEnvironment = false;
        }

        this.clientId = clientId;
        this.domain = domain;
        this.baseUrl = baseUrl;
        this.authorityUrl = authorityUrl;
        this.activeDirectoryResourceId = activeDirectoryResourceId;
        this.isAzureStackEnvironment = isAzureStackEnvironment;

        this.scheme = scheme ? AzureModels.Scheme[scheme] :  AzureModels.Scheme['ServicePrincipal'] ;
        this.msiClientId = msiClientId ;
        if(this.scheme == AzureModels.Scheme['ServicePrincipal']) {
            this.authType = authType ? authType : constants.AzureServicePrinicipalAuthentications.servicePrincipalKey;
            if(this.authType == constants.AzureServicePrinicipalAuthentications.servicePrincipalKey) {
                this.secret = secret;
            }
            else {
                this.certFilePath = certFilePath;
            }
        }
        
        this.isADFSEnabled = isADFSEnabled;

    }

    public getToken(force?: boolean): Q.Promise<string> {
        if (!this.token_deferred || force) {
            if(this.scheme === AzureModels.Scheme.ManagedServiceIdentity)
            {
                this.token_deferred = this._getMSIAuthorizationToken(0, 0);
            }
            else
            {
                this.token_deferred = this._getSPNAuthorizationToken();
            }
        }

        return this.token_deferred;
    }

    public getDomain(): string {
        return this.domain;
    }

    public getClientId(): string {
        return this.clientId;
    }

    private _getMSIAuthorizationToken(retyCount: number ,timeToWait: number): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "GET";
        let apiVersion = "2018-02-01";
        const retryLimit = 5;
        let msiClientId =  this.msiClientId ? "&client_id=" + this.msiClientId : "";       
        webRequest.uri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + apiVersion + "&resource="+ this.baseUrl + msiClientId;
        webRequest.headers = {
            "Metadata": true
        };

        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) 
                {
                    deferred.resolve(response.body.access_token);
                }
                else if (response.statusCode == 429 || response.statusCode == 500)
                {
                    if(retyCount < retryLimit)
                    {
                        let waitedTime = 2000 + timeToWait * 2;
                        retyCount +=1;
                        setTimeout(() => {
                            this._getMSIAuthorizationToken(retyCount, waitedTime);
                        }, waitedTime);
                    } 
                    else
                    {
                        deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIStatusCode', response.statusCode, response.statusMessage));
                    }

                }
                else 
                {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIDueToMSINotConfiguredProperlyStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );

        return deferred.promise;
    }

    private _getSPNAuthorizationToken(): Q.Promise<string> {
        if(this.authType == constants.AzureServicePrinicipalAuthentications.servicePrincipalKey) {
            return this._getSPNAuthorizationTokenFromKey();
        }

        return this._getSPNAuthorizationTokenFromCertificate()
    }

    private _getSPNAuthorizationTokenFromCertificate(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + (this.isADFSEnabled ? "" : this.domain) + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this.activeDirectoryResourceId,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_assertion: this._getSPNCertificateAuthorizationToken(),
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        });

        let webRequestOptions: webClient.WebRequestOptions = {
            retriableStatusCodes: [400, 408, 409, 500, 502, 503, 504]
        };

        webClient.sendRequest(webRequest, webRequestOptions).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if([400, 401, 403].indexOf(response.statusCode) != -1) {
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


    private _getSPNAuthorizationTokenFromKey(): Q.Promise<string> {        
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + (this.isADFSEnabled ? "" : this.domain) + "/oauth2/token/";
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
            retriableStatusCodes: [400, 408, 409, 500, 502, 503, 504]
        };

        webClient.sendRequest(webRequest, webRequestOptions).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if([400, 401, 403].indexOf(response.statusCode) != -1) {
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

    private _getSPNCertificateAuthorizationToken(): string {
        var openSSLPath =   tl.osType().match(/^Win/) ? tl.which(path.join(__dirname, '..', 'openssl', 'openssl')) : tl.which('openssl');
        var openSSLArgsArray= [
            "x509",
            "-noout",
            "-in" ,
            this.certFilePath,
            "-fingerprint"
        ];

        var pemExecutionResult = tl.execSync(openSSLPath, openSSLArgsArray);
        var additionalHeaders = {
            "alg": "RS256",
            "typ": "JWT",
        };

        if(pemExecutionResult.code == 0) {
            tl.debug("FINGERPRINT CREATION SUCCESSFUL");
            let shaFingerprint = pemExecutionResult.stdout;
            let shaFingerPrintHashCode = shaFingerprint.split("=")[1].replace(new RegExp(":", 'g'), "");
            let fingerPrintHashBase64: string = Buffer.from(
                shaFingerPrintHashCode.match(/\w{2}/g).map(function(a) { 
                    return String.fromCharCode(parseInt(a, 16));
                } ).join(""),
                'binary'
            ).toString('base64');
            additionalHeaders["x5t"] = fingerPrintHashBase64;
        }
        else {
            console.log(pemExecutionResult);
            throw new Error(pemExecutionResult.stderr);
        }

        return getJWT(this.authorityUrl, this.clientId, this.domain, this.certFilePath, additionalHeaders, this.isADFSEnabled);
    }

}

function getJWT(url: string, clientId: string, tenantId: string, pemFilePath: string, additionalHeaders, isADFSEnabled: boolean) {

    var pemFileContent = fs.readFileSync(pemFilePath);
    var jwtObject = {
        "aud": (`${url}/${!isADFSEnabled ? tenantId : ""}/oauth2/token`).replace(/([^:]\/)\/+/g, "$1"),
        "iss": clientId,
        "sub": clientId,
        "jti": "" + Math.random(),
        "nbf":  (Math.floor(Date.now()/1000)-1000),
        "exp": (Math.floor(Date.now()/1000)+8640000)
    };

    var token = jwt.sign(jwtObject, pemFileContent,{ algorithm: 'RS256', header :additionalHeaders });
    return token;
}
