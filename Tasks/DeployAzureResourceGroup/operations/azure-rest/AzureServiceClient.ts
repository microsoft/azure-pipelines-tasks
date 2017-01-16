import tl = require('vsts-task-lib/task');
import util = require("util")
import msRestAzure = require("./ms-rest-azure");
var httpClient = require('vso-node-api/HttpClient');
var httpCallbackClient = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

export class WebRequest {
    public method;
    public uri;
    public body;
    public headers;
}

export class WebResponse {
    public statusCode;
    public headers;
    public body;
}

export class ApiResult {
    public error;
    public result;
    public request;
    public response;

    constructor(error, result?, request?, response?) {
        this.error = error;
        this.result = result;
        this.request = request;
        this.response = response;
    }
}

export class AzureError {
    public code;
    public message;
    public statusCode;
    public details;
}

export interface ApiCallback {
    (error: any, result?: any, request?: any, response?: any): void
}

export function ToError(response: WebResponse): AzureError {
    var error = new AzureError();
    error.statusCode = response.statusCode;
    error.message = response.body
    if (response.body && response.body.error) {
        error.code = response.body.error.code;
        error.message = response.body.error.message;
        error.details = response.body.error.details;
    }

    return error;
}

export class ServiceClient {
    private credentials: msRestAzure.ApplicationTokenCredentials;
    private subscriptionId: string;
    protected apiVersion: string;
    protected baseUri: string;
    protected acceptLanguage: string;
    protected longRunningOperationRetryTimeout: number;
    protected generateClientRequestId: boolean;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        if (!credentials) {
            throw new Error(tl.loc("CredentialsCannotBeNull"));
        }
        if (!subscriptionId) {
            throw new Error(tl.loc("SubscriptionIdCannotBeNull"));
        }

        this.credentials = credentials;
        this.subscriptionId = subscriptionId
        this.baseUri = 'https://management.azure.com';
        this.longRunningOperationRetryTimeout = 60; // In minutes
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[]): string {
        var requestUri = this.baseUri + uriFormat;
        requestUri = requestUri.replace('{subscriptionId}', encodeURIComponent(this.subscriptionId));
        for (var key in parameters) {
            requestUri = requestUri.replace(key, encodeURIComponent(parameters[key]));
        }

        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUri = requestUri.replace(regex, '$1');

        // process query paramerters
        queryParameters = queryParameters || [];
        queryParameters.push('api-version=' + encodeURIComponent(this.apiVersion));
        if (queryParameters.length > 0) {
            requestUri += '?' + queryParameters.join('&');
        }

        return requestUri
    }

    public setCustomHeaders(options: Object): {} {
        var headers = {};
        if (options) {
            for (var headerName in options['customHeaders']) {
                if (options['customHeaders'].hasOwnProperty(headerName)) {
                    headers[headerName] = options['customHeaders'][headerName];
                }
            }
        }
        return headers;
    }

    public async beginRequest(request: WebRequest): Promise<WebResponse> {
        var token = await this.credentials.getToken();

        request.headers = request.headers || {};
        request.headers["Authorization"] = "Bearer " + token;
        if (this.acceptLanguage) {
            request.headers['accept-language'] = this.acceptLanguage;
        }
        request.headers['Content-Type'] = 'application/json; charset=utf-8';

        var httpResponse = await this.beginRequestInternal(request);
        if (httpResponse.statusCode === 401 && httpResponse.body.error.code === "ExpiredAuthenticationToken") {
            // The access token might have expire. Re-issue the request after refreshing the token.
            token = await this.credentials.getToken(true);
            request.headers["Authorization"] = "Bearer " + token;
            httpResponse = await this.beginRequestInternal(request);
        }

        return httpResponse;
    }

    public async getLongRunningOperationResult(response: WebResponse, timeoutInMinutes?: number): Promise<WebResponse> {
        timeoutInMinutes = timeoutInMinutes || this.longRunningOperationRetryTimeout;
        var timeout = new Date().getTime() + timeoutInMinutes * 60 * 1000;

        var request = new WebRequest();
        request.method = "GET";
        request.uri = response.headers["azure-asyncoperation"] || response.headers["location"];
        if (!request.uri) {
            throw (tl.loc("InvalidResponseLongRunningOperation"));
        }

        while (true) {
            response = await this.beginRequest(request);
            if (response.statusCode === 202 || response.body.status == "Accepted" || response.body.status == "Running" || response.body.status == "InProgress") {
                // If timeout; throw;
                if (timeout < new Date().getTime()) {
                    throw (tl.loc("TimeoutWhileWaiting"));
                }

                // Retry after given interval.
                var sleepDuration = 15;
                if (response.headers["retry-after"]) {
                    sleepDuration = parseInt(response.headers["retry-after"]);
                }
                await this.sleepFor(sleepDuration);
            } else {
                break;
            }
        }

        return response;
    }

    public async accumulateResultFromPagedResult(nextLinkUrl: string): Promise<ApiResult> {
        var result = [];
        while (nextLinkUrl) {
            var nextRequest = new WebRequest();
            nextRequest.method = 'GET';
            nextRequest.uri = nextLinkUrl;
            var response = await this.beginRequest(nextRequest);
            if (response.statusCode == 200 && response.body.value) {
                result.concat(response.body.value)
            }
            else {
                return new ApiResult(ToError(response));
            }
        }

        return new ApiResult(null, result);
    }

    public isValidResourceGroupName(resourceGroupName: string) {
        if (!resourceGroupName === null || resourceGroupName === undefined || typeof resourceGroupName.valueOf() !== 'string') {
            throw new Error(tl.loc("ResourceGroupCannotBeNull"));
        }
        if (resourceGroupName !== null && resourceGroupName !== undefined) {
            if (resourceGroupName.length > 90) {
                throw new Error(tl.loc("ResourceGroupExceededLength"));
            }
            if (resourceGroupName.length < 1) {
                throw new Error(tl.loc("ResourceGroupDeceededLength"));
            }
            if (resourceGroupName.match(/^[-\w\._\(\)]+$/) === null) {
                throw new Error(tl.loc("ResourceGroupDoesntMatchPattern"));
            }
        }
    }
    
    private toWebResponse(response, body): WebResponse {
        var res = new WebResponse();

        if (response) {
            res.statusCode = response.statusCode;
            res.headers = response.headers;
            if (body) {
                try {
                    res.body = JSON.parse(body);
                }
                catch (error) {
                    res.body = body;
                }
            }
        }
        return res;
    }

    private beginRequestInternal(request: WebRequest): Promise<WebResponse> {
        tl.debug(util.format("[%s]%s", request.method, request.uri));
        return new Promise<WebResponse>((resolve, reject) => {
            httpCallbackClient.send(request.method, request.uri, request.body, request.headers, (error, response, body) => {
                if (error) {
                    reject(error);
                }
                else {
                    var httpResponse = this.toWebResponse(response, body);
                    resolve(httpResponse);
                }
            });
        });
    }

    private sleepFor(sleepDurationInSeconds): Promise<any> {
        return new Promise((resolve, reeject) => {
            setTimeout(resolve, sleepDurationInSeconds * 1000);
        });
    }
}
