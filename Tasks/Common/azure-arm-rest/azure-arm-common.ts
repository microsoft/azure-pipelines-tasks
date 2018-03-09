import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import webClient = require("./webClient");
import { AzureEndpoint } from "./azureModels";
import constants = require('./constants');

export class ApplicationTokenCredentials {
    private token_deferred: Q.Promise<string>;
    private _endpoint: AzureEndpoint;

    constructor(endpoint: AzureEndpoint) {
        if(!endpoint){
            throw new Error(tl.loc("SpecifiedAzureRmEndpointIsInvalid"));
        }
    
        if (!Boolean(endpoint.tenantID) || typeof endpoint.tenantID.valueOf() !== 'string') {
            throw new Error(tl.loc("DomainCannotBeEmpty"));
        }

        if (!Boolean(endpoint.url) || typeof endpoint.url.valueOf() !== 'string') {
            throw new Error(tl.loc("armUrlCannotBeEmpty"));
        }

        if (!Boolean(endpoint.environmentAuthorityUrl) || typeof endpoint.environmentAuthorityUrl.valueOf() !== 'string') {
            throw new Error(tl.loc("authorityUrlCannotBeEmpty"));
        }

        if (!Boolean(endpoint.activeDirectoryResourceID) || typeof endpoint.activeDirectoryResourceID.valueOf() !== 'string') {
            throw new Error(tl.loc("activeDirectoryResourceIdUrlCannotBeEmpty"));
        }

        this._endpoint = endpoint;
    }

    public getToken(force?: boolean): Q.Promise<string> {
        if (!this.token_deferred || force) {
            if(this._endpoint.scheme === "MSI")
            {
                this.token_deferred = this._getMSIAuthorizationToken();
            }
            else
            {
                this.token_deferred = this._getSPNAuthorizationToken();
            }
            
        }

        return this.token_deferred;
    }

    public getDomain(): string {
        return this._endpoint.tenantID;
    }

    public getClientId(): string {
        return this._endpoint.servicePrincipalClientID;
    }

    public getbaseUrl(): string {
        return this._endpoint.url;
    }

    public isAzureStackEnvironment(): boolean {
        let isAzureStackEnvironment = this._endpoint.environment.toLowerCase() == constants.AzureEnvironments.AzureStack;
        if(!Boolean(isAzureStackEnvironment) || typeof isAzureStackEnvironment.valueOf() != 'boolean') {
            isAzureStackEnvironment = false;
        }

        return isAzureStackEnvironment;
    }

    private _getMSIAuthorizationToken(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "GET";
        let port = this._endpoint.msiPort ? this._endpoint.msiPort : '50342';
        webRequest.uri = "http://localhost:"+ port + "/oauth2/token?resource="+ this._endpoint.url;
        webRequest.headers = {
            "Metadata": true
        };

        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );

        return deferred.promise;
    }

    private _getSPNAuthorizationToken(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this._endpoint.environmentAuthorityUrl + this._endpoint.tenantID + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this._endpoint.activeDirectoryResourceID,
            client_id: this._endpoint.servicePrincipalClientID,
            grant_type: "client_credentials",
            client_secret: this._endpoint.servicePrincipalKey
        });
        webRequest.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        };

        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
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
}