import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
var httpClient = require('vso-node-api/HttpClient');
var util = require('util');

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

var authUrl = 'https://login.windows.net/';
var armUrl = 'https://management.azure.com/';
var azureApiVersion = 'api-version=2016-08-01';


export class ApplicationTokenCredentials {
    private clientId: string;
    private domain: string;
    private secret: string;
    public armUrl: string;
    public authUrl: string;
    private token_deferred: Q.Promise<string>;

    constructor(clientId: string, domain: string, secret: string, armUrl: string, authUrl: string) {
        if (!Boolean(clientId) || typeof clientId.valueOf() !== 'string') {
            throw new Error(tl.loc("ClientIdCannotBeEmpty"));
        }

        if (!Boolean(domain) || typeof domain.valueOf() !== 'string') {
            throw new Error(tl.loc("DomainCannotBeEmpty"));
        }

        if (!Boolean(secret) || typeof secret.valueOf() !== 'string') {
            throw new Error(tl.loc("SecretCannotBeEmpty"));
        }

        if (!Boolean(armUrl) || typeof armUrl.valueOf() !== 'string') {
            throw new Error(tl.loc("armUrlCannotBeEmpty"));
        }

        if (!Boolean(authUrl) || typeof authUrl.valueOf() !== 'string') {
            throw new Error(tl.loc("authUrlCannotBeEmpty"));
        }

        this.clientId = clientId;
        this.domain = domain;
        this.secret = secret;
        this.armUrl = armUrl;
        this.authUrl = authUrl;
    }

    public getToken(force?: boolean): Q.Promise<string> {
        if (!this.token_deferred || force) {
            this.token_deferred = this.getAuthorizationToken();
        }

        return this.token_deferred;
    }

    private getAuthorizationToken(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        var authorityUrl = this.authUrl + this.domain + "/oauth2/token/";
        var requestData = querystring.stringify({
            resource: this.armUrl,
            client_id: this.clientId,
            grant_type: "client_credentials",
            client_secret: this.secret
        });
        var requestHeader = {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        };

        tl.debug('Requesting for Auth Token: ' + authorityUrl);
        httpObj.send('POST', authorityUrl, requestData, requestHeader, (error, response, body) => {
            if (error) {
                deferred.reject(error);
            }
            else if (response.statusCode == 200) {
                deferred.resolve(JSON.parse(body).access_token);
            }
            else {
                deferred.reject(tl.loc('CouldNotFetchAccessTokenforAzureStatusCode', response.statusCode, response.statusMessage));
            }
        });
        return deferred.promise;
    }
}
