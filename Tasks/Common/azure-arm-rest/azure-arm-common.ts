import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import webClient = require("./webClient");

export class ApplicationTokenCredentials {
    private clientId: string;
    private domain: string;
    private secret: string;
    public baseUrl: string;
    public authorityUrl: string;
    public activeDirectoryResourceId: string;
    public isAzureStackEnvironment: boolean;
    private token_deferred: Q.Promise<string>;

    constructor(clientId: string, domain: string, secret: string, baseUrl: string, authorityUrl: string, activeDirectoryResourceId: string, isAzureStackEnvironment: boolean) {
        if (!Boolean(clientId) || typeof clientId.valueOf() !== 'string') {
            throw new Error(tl.loc("ClientIdCannotBeEmpty"));
        }

        if (!Boolean(domain) || typeof domain.valueOf() !== 'string') {
            throw new Error(tl.loc("DomainCannotBeEmpty"));
        }

        if (!Boolean(secret) || typeof secret.valueOf() !== 'string') {
            throw new Error(tl.loc("SecretCannotBeEmpty"));
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
        this.secret = secret;
        this.baseUrl = baseUrl;
        this.authorityUrl = authorityUrl;
        this.activeDirectoryResourceId = activeDirectoryResourceId;
        this.isAzureStackEnvironment = isAzureStackEnvironment;
    }

    public getToken(force?: boolean): Q.Promise<string> {
        if (!this.token_deferred || force) {
            this.token_deferred = this.getAuthorizationToken();
        }

        return this.token_deferred;
    }

    public getDomain(): string {
        return this.domain;
    }

    public getClientId(): string {
        return this.clientId;
    }

    private getAuthorizationToken(): Q.Promise<string> {
        var deferred = Q.defer<string>();

        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        webRequest.uri = this.authorityUrl + this.domain + "/oauth2/token/";
        webRequest.body = querystring.stringify({
            resource: this.activeDirectoryResourceId,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_secret: this.secret
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