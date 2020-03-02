import tl = require('azure-pipelines-task-lib/task');
import msRestAzure = require("./azure-arm-common");
import webClient = require("./webClient");

const CorrelationIdInResponse = "x-ms-correlation-request-id";

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

export function ToError(response: webClient.WebResponse): AzureError {
    var error = new AzureError();
    error.statusCode = response.statusCode;
    error.message = response.body
    if (response.body && response.body.error) {
        error.code = response.body.error.code;
        error.message = response.body.error.message;
        error.details = response.body.error.details;

        console.log("##vso[task.logissue type=error;code="+error.code+";]");
    }

    return error;
}

export class ServiceClient {
    private credentials: msRestAzure.ApplicationTokenCredentials;
    protected apiVersion: string;
    protected baseUri: string;
    protected acceptLanguage: string;
    protected longRunningOperationRetryTimeout: number;
    protected generateClientRequestId: boolean;

    public subscriptionId: string;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string, timeout?: number) {
        this.validateInputs(credentials, subscriptionId);

        this.credentials = credentials;
        this.subscriptionId = subscriptionId
        this.baseUri = this.credentials.baseUrl;
        this.longRunningOperationRetryTimeout = !!timeout ? timeout : 0; // In minutes
    }

    protected validateInputs(credentials: msRestAzure.ApplicationTokenCredentials, subscriptionId: string) {
        if (!credentials) {
            throw new Error(tl.loc("CredentialsCannotBeNull"));
        }
        if (!subscriptionId) {
            throw new Error(tl.loc("SubscriptionIdCannotBeNull"));
        }
    }

    public getCredentials(): msRestAzure.ApplicationTokenCredentials {
        return this.credentials;
    }

    public getRequestUri(uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string {
        return this.getRequestUriForBaseUri(this.baseUri, uriFormat, parameters, queryParameters, apiVersion);
    }

    public getRequestUriForBaseUri(baseUri: string, uriFormat: string, parameters: {}, queryParameters?: string[], apiVersion?: string): string {
        var requestUri = baseUri + uriFormat;
        requestUri = requestUri.replace('{subscriptionId}', encodeURIComponent(this.subscriptionId));
        for (var key in parameters) {
            requestUri = requestUri.replace(key, encodeURIComponent(parameters[key]));
        }

        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUri = requestUri.replace(regex, '$1');

        // process query paramerters
        queryParameters = queryParameters || [];
        queryParameters.push('api-version=' + encodeURIComponent(apiVersion || this.apiVersion));
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

    public async beginRequest(request: webClient.WebRequest): Promise<webClient.WebResponse> {
        var token = await this.credentials.getToken();

        request.headers = request.headers || {};
        request.headers["Authorization"] = "Bearer " + token;
        if (this.acceptLanguage) {
            request.headers['accept-language'] = this.acceptLanguage;
        }
        request.headers['Content-Type'] = 'application/json; charset=utf-8';

        var httpResponse = null;

        try
        {
            httpResponse = await webClient.sendRequest(request);
            if (httpResponse.statusCode === 401 && httpResponse.body && httpResponse.body.error && httpResponse.body.error.code === "ExpiredAuthenticationToken") {
                // The access token might have expire. Re-issue the request after refreshing the token.
                token = await this.credentials.getToken(true);
                request.headers["Authorization"] = "Bearer " + token;
                httpResponse = await webClient.sendRequest(request);
            }

            if(!!httpResponse.headers[CorrelationIdInResponse]) {
                tl.debug(`Correlation ID from ARM api call response : ${httpResponse.headers[CorrelationIdInResponse]}`);
            }
        } catch(exception) {
            let exceptionString: string = exception.toString();
            if(exceptionString.indexOf("Hostname/IP doesn't match certificates's altnames") != -1
                || exceptionString.indexOf("unable to verify the first certificate") != -1
                || exceptionString.indexOf("unable to get local issuer certificate") != -1) {
                    tl.warning(tl.loc('ASE_SSLIssueRecommendation'));
            } 

            throw exception;
        }

        return httpResponse;
    }

    public async getLongRunningOperationResult(response: webClient.WebResponse, timeoutInMinutes?: number): Promise<webClient.WebResponse> {
        timeoutInMinutes = timeoutInMinutes || this.longRunningOperationRetryTimeout;
        var timeout = new Date().getTime() + timeoutInMinutes * 60 * 1000;
        var waitIndefinitely = timeoutInMinutes == 0;
        var request = new webClient.WebRequest();
        request.method = "GET";
        request.uri = response.headers["azure-asyncoperation"] || response.headers["location"];
        if (!request.uri) {
            throw new Error(tl.loc("InvalidResponseLongRunningOperation"));
        }

        while (true) {
            response = await this.beginRequest(request);
            tl.debug(`Response status code : ${response.statusCode}`);
            if (response.statusCode === 202 || (response.body && (response.body.status == "Accepted" || response.body.status == "Running" || response.body.status == "InProgress"))) {
                // If timeout; throw;
                if (!waitIndefinitely && timeout < new Date().getTime()) {
                    throw new Error(tl.loc("TimeoutWhileWaiting"));
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

    public async beginRequestExpBackoff(request: webClient.WebRequest, maxAttempt: number): Promise<webClient.WebResponse> {
        var sleepDuration = 1;
        for(var i = 1; true; i++) {
            var response : webClient.WebResponse = await this.beginRequest(request);
            //not a server error;
            if(response.statusCode <500) {
                return response;
            }

            // response of last attempt
            if(i == maxAttempt) {
                return response;
            }

            // Retry after given interval.
            sleepDuration = sleepDuration + i;
            if (response.headers["retry-after"]) {
                sleepDuration = parseInt(response.headers["retry-after"]);
            }

            tl.debug(tl.loc("RetryingRequest", sleepDuration));
            await this.sleepFor(sleepDuration);
        }
    }

    public async accumulateResultFromPagedResult(nextLinkUrl: string): Promise<ApiResult> {
        var result = [];
        while (nextLinkUrl) {
            var nextRequest = new webClient.WebRequest();
            nextRequest.method = 'GET';
            nextRequest.uri = nextLinkUrl;
            var response = await this.beginRequest(nextRequest);
            if (response.statusCode == 200 && response.body) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                nextLinkUrl = response.body.nextLink;
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

    public isNameValid(name: string): boolean {
        if (name === null || name === undefined || typeof name.valueOf() !== 'string') {
            return false;
        }else{
            return true;
        }
    }

    public getFormattedError(error: any): string {
        if(error && error.message) {
            if(error.statusCode) {
                var errorMessage = typeof error.message.valueOf() == 'string' ? error.message 
                    : (error.message.Code || error.message.code) + " - " + (error.message.Message || error.message.message)
                error.message = `${errorMessage} (CODE: ${error.statusCode})`
            }

            return error.message;
        }

        return error;
    }

    private sleepFor(sleepDurationInSeconds): Promise<any> {
        return new Promise((resolve, reeject) => {
            setTimeout(resolve, sleepDurationInSeconds * 1000);
        });
    }
}
