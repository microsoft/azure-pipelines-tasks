var httpClient = require('vso-node-api/HttpClient');
import msRestAzure = require("./ms-rest-azure");
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

    constructor(credentials: msRestAzure.ApplicationTokenCredentials) {
        this.credentials = credentials;
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
        timeoutInMinutes = timeoutInMinutes || 60;
        var timeout = new Date().getTime() + timeoutInMinutes * 60 * 1000;

        var request = new WebRequest();
        request.method = "GET";
        request.uri = response.headers["azure-asyncoperation"] || response.headers["location"];
        if (!request.uri) {
            throw "Invalid response of a long running operation.";
        }

        while (true) {
            if (request.uri) {
                response = await this.beginRequest(request);
                if (response.statusCode === 202 || response.body.status == "Running" || response.body.status == "InProgress") {
                    // If timeout; throw;
                    if (timeout < new Date().getTime()) {
                        throw ("Timeout out while waiting for the operation to complete.")
                    }

                    // Retry after given interval.
                    var sleepDuration = 15;
                    if (response.headers["retry-after"]) {
                        sleepDuration = parseInt(response.headers["retry-after"]);
                    }
                    await this.sleepFor(sleepDuration);
                }
            }
            else {
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
