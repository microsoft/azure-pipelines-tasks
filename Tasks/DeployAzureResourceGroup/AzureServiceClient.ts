var httpClient = require('vso-node-api/HttpClient');
import msRestAzure = require("./ms-rest-azure");
import Q = require("q");
var uuid = require('uuid');

var httpCallbackClient = new httpClient.HttpCallbackClient("VSTS_AGENT");

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

export class Error {
    public code;
    public message;
    public statusCode;
}

export function ToError(response: WebResponse): Error {
    var error = new Error();
    error.statusCode = response.statusCode;
    error.message = response.body
    if (response.body && response.body.error) {
        error.code = response.body.error.code;
        error.message = response.body.error.message;
    }

    return error;
}

export class ServiceClient {
    private credentials: msRestAzure.ApplicationTokenCredentials;
    private longRunningOperationTimeout: number;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials) {
        this.credentials = credentials;
        this.longRunningOperationTimeout = 30;
    }

    public async beginRequest(request: WebRequest): Promise<WebResponse> {
        var token = await this.credentials.getToken();
        request.headers == request.headers || {};
        request.headers["Authorization"] = "Bearer " + token;

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
        var deferred = Q.defer<WebResponse>();
        var request = new WebRequest();
        request.method = "GET";
        timeoutInMinutes = timeoutInMinutes | 60;
        var timeout = new Date().getTime() + timeoutInMinutes * 60 * 1000;
        while (true) {
            request.uri = response.headers["azure-asyncoperation"] || response.headers["location"];
            if (request.uri) {
                response = await this.beginRequest(request);
                if (response.statusCode === 202 || response.body.status == "InProgress") {
                    // If timeout; throw;
                    if (timeout < new Date().getTime()) {
                        throw ("Timeout out while waiting for the operation to complete.")
                    }

                    // Retry after given interval.
                    var sleepDuration = 15;
                    if (response.headers["Retry-After"]) {
                        sleepDuration = parseInt(response.headers["Retry-After"]);
                    }
                    await sleepFor(sleepDuration);
                }
                else {
                    break;
                }
            }
            else {
                throw "Invalid response of a long running operation.";
            }
        }

        return response;
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

    private beginRequestInternal(request: WebRequest): Q.Promise<WebResponse> {
        var deferred = Q.defer<WebResponse>();
        httpCallbackClient.send(request.method, request.uri, request.body, request.headers, (error, response, body) => {
            if (error) {
                deferred.reject(error);
            }
            else {
                var httpResponse = this.toWebResponse(response, body);
                deferred.resolve(httpResponse);
            }
        });
        return deferred.promise;
    }

    private sleepFor(sleepDurationInSeconds): Promise<any> {
        return new Promise((resolve, reeject) => {
            setTimeout(resolve, sleepDurationInSeconds * 1000);
        });
    }
}
