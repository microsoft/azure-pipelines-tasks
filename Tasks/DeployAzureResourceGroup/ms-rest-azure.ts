import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
var httpClient = require('vso-node-api/HttpClient');
var restClient = require('vso-node-api/RestClient');
var uuid = require('uuid');
var util = require('util');

var httpObj = new httpClient.HttpCallbackClient("AZURE_HTTP_USER_AGENT");
var restObj = new restClient.RestCallbackClient(httpObj);

var authUrl = 'https://login.windows.net/';
var armUrl = 'https://management.azure.com/';
var azureApiVersion = 'api-version=2016-08-01';


export class ApplicationTokenCredentials {
    private clientId;
    private domain;
    private secret;
    private token;
    private token_deferred;

    constructor(clientId, domain, secret) {
        if (!Boolean(clientId) || typeof clientId.valueOf() !== 'string') {
            throw new Error('clientId must be a non empty string.');
        }

        if (!Boolean(domain) || typeof domain.valueOf() !== 'string') {
            throw new Error('domain must be a non empty string.');
        }

        if (!Boolean(secret) || typeof secret.valueOf() !== 'string') {
            throw new Error('secret must be a non empty string.');
        }

        this.clientId = clientId;
        this.domain = domain;
        this.secret = secret;
    }

    private getAuthorizationToken(): Q.Promise<string> {
        var deferred = Q.defer<string>();
        var authorityUrl = authUrl + this.domain + "/oauth2/token/";
        var requestData = querystring.stringify({
            resource: 'https://management.azure.com/',
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

    public getToken(force?: boolean): Q.Promise<string> {
        if (!this.token_deferred || force) {
            var deferred = Q.defer<string>();
            this.getAuthorizationToken()
                .then((token) => {
                    this.token = token;
                    deferred.resolve(this.token);
                });
            this.token_deferred = deferred;
        }
        return this.token_deferred.promise;
    }

}

export function generateUuid() {
    return uuid.v4();
};

export class CloudError {
    constructor() { }

    public mapper() {
        return {
            required: false,
            serializedName: 'CloudError',
            type: {
                name: 'Composite',
                className: 'CloudError',
                modelProperties: {
                    code: {
                        required: false,
                        serializedName: 'code',
                        type: {
                            name: 'String'
                        }
                    },
                    message: {
                        required: false,
                        serializedName: 'message',
                        type: {
                            name: 'String'
                        }
                    },
                    target: {
                        required: false,
                        serializedName: 'target',
                        type: {
                            name: 'String'
                        }
                    },
                    details: {
                        required: false,
                        serializedName: 'details',
                        type: {
                            name: 'Sequence',
                            element: {
                                required: false,
                                serializedName: 'CloudErrorElementType',
                                type: {
                                    name: 'Composite',
                                    className: 'CloudError'
                                }
                            }
                        }
                    }
                }
            }
        };
    }
}

export class Error {
    public message;
    public statusCode;
    public code;
    public request;
    public response;
    public body;

    constructor(message: string) {
        this.message = message;
    }
}

export class stripResponse {
    constructor(response) {
        var strippedResponse = {};
        strippedResponse['body'] = response.body;
        strippedResponse['headers'] = response.headers;
        strippedResponse['statusCode'] = response.statusCode;
        return strippedResponse;
    }
}

/**
 * Returns a stripped version of the Http Request that does not contain the 
 * Authorization header.
 * 
 * @param {object} request - The Http Request object
 * 
 * @return {object} strippedRequest - The stripped version of Http Request.
 */
export class stripRequest {
    constructor(request) {
        var strippedRequest = {};
        try {
            strippedRequest = JSON.parse(JSON.stringify(request));
            if (strippedRequest['headers'] && strippedRequest['headers']['Authorization']) {
                delete strippedRequest['headers']['Authorization'];
            } else if (strippedRequest['headers'] && strippedRequest['headers']['authorization']) {
                delete strippedRequest['headers']['authorization'];
            }
        } catch (err) {
            var errMsg = err.message;
            err.message = util.format('Error - "%s" occured while creating a stripped version of the request object - "%s".', errMsg, request);
            return err;
        }

        return strippedRequest;
    }
}