import tl = require('vsts-task-lib/task');
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
    public baseUrl: string;
    public authorityUrl: string;
    public activeDirectoryResourceId: string;
    public isAzureStackEnvironment: boolean;
    public scheme: number;
    public msiClientId: string;
    private token_deferred: Q.Promise<string>;

    constructor(clientId: string, domain: string, secret: string, baseUrl: string, authorityUrl: string, activeDirectoryResourceId: string, isAzureStackEnvironment: boolean, scheme?: string, msiClientId?: string, authType?: string, certFilePath?: string) {

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
                            deferred.resolve(this._getMSIAuthorizationToken(retyCount, waitedTime));   
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

    private _getSPNAuthorizationTokenFromCertificate(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + this.domain + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this.activeDirectoryResourceId,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_secret: this._getSPNCertificateAuthorizationToken()
        });

        console.log(webRequest.body);
        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) 
                {
                    deferred.resolve(response.body.access_token);
                }
                else 
                {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );
        return deferred.promise;
    }

    private _getSPNAuthorizationToken(): Q.Promise<string> {

        if(1<2) {
            console.log(this._getSPNCertificateAuthorizationToken());
            return (this._getSPNAuthorizationTokenFromCertificate());  
        }
        
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + this.domain + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this.activeDirectoryResourceId,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_assertion: this.secret,
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        });
        webRequest.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        };

        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) 
                {
                    deferred.resolve(response.body.access_token);
                }
                else 
                {
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
        var openSSLPath = tl.which(path.join(__dirname, 'openssl', 'openssl'));
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

        console.log(pemExecutionResult);
        if(pemExecutionResult.code == 0) {
            console.log("FINGERPRINT CREATION SUCCESSFUL");
            let shaFingerprint = pemExecutionResult.stdout;
            let shaFingerPrintHashCode = shaFingerprint.split("=")[1].replace(new RegExp(":", 'g'), "");
            let fingerPrintHashBase64: string = Buffer.from(
                shaFingerPrintHashCode.match(/\w{2}/g).map(function(a){return String.fromCharCode(parseInt(a, 16));} ).join(""), 'binary'
            ).toString('base64');
            additionalHeaders["x5t"] = fingerPrintHashBase64;
        }
        else {
            throw new Error("FINGERPRINT CREATION Failed." + pemExecutionResult.stderr);
        }

        return getJWT(this.authorityUrl, this.clientId, this.domain, this.certFilePath, additionalHeaders);
    }

}

function getJWT(url: string, applicationID: string, tenantID: string, pemFilePath: string, additionalHeaders) {

    var pemFileContent = fs.readFileSync(pemFilePath);
    var jwtObject = {
        "aud": `${url}${tenantID}/oauth2/token`,
        "iss": applicationID,
        "sub": applicationID,
        "jti": "" + Math.random(),
        "nbf":  (Math.floor(Date.now()/1000)-1000),
        "exp": (Math.floor(Date.now()/1000)+8640000)
    };

    var token = jwt.sign(jwtObject, pemFileContent,{ algorithm: 'RS256', header :additionalHeaders });
    return token;
}