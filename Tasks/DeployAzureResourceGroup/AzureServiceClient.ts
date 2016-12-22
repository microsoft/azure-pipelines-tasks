var httpClient = require('vso-node-api/HttpClient');
var restClient = require('vso-node-api/RestClient');
import Q = require("q");
var uuid = require('uuid');

var httpCallbackClient = new httpClient.HttpCallbackClient("VSTS_AGENT");
var restObj = new restClient.RestCallbackClient(httpCallbackClient);

function sleepFor(sleepDuration) {
    var now = new Date().getTime();
    while (new Date().getTime() < now + sleepDuration) { /* do nothing */ }
}

export class WebRequest {
    public method;
    public uri;
    public body;
    public headers;
}

export class WebResponse {
    public error;
    public body;
    public statusCode;
    public headers;
}
export class Error {
    public code;
    public message;
    public statusCode;
}
export class ServiceClient {
    private credentials;
    private longRunningOperationTimeout;

    constructor(credentials) {
        this.credentials = credentials;
        this.longRunningOperationTimeout = 30;
    }

    private makeResponse(error, response, body) {
        var res = new WebResponse();
        if (error && typeof (error) === typeof ("")) {
            error = JSON.parse(error);
            res.error = error;
        } else if (error) {
            res.error = error;
        }
        if (response) {
            res.statusCode = response.statusCode;
            res.headers = response.headers;
            if (body) {
                try {
                    res.body = JSON.parse(body);
                }
                catch (error) {
                    res.error = error;
                }
            }
        }
        return res;
    }

    private beginRequest(request: WebRequest) {
        var deferred = Q.defer<WebResponse>();
        httpCallbackClient.send(request.method, request.uri, request.body, request.headers, (error, response, body) => {
            var HttpResponse = this.makeResponse(error, response, body);
            deferred.resolve(HttpResponse);
        });
        return deferred.promise;
    }

    public request(request: WebRequest): Q.Promise<WebResponse> {
        var deferred = Q.defer<WebResponse>();
        this.credentials.getToken().then((token) => {
            request.headers["Authorization"] = "Bearer " + token;
            this.beginRequest(request).then((httpResponse: WebResponse) => {
                // If token expires, generate a new token
                if (httpResponse.statusCode === 401 && httpResponse.body.error.code === "ExpiredAuthenticationToken") {
                    this.credentials.getToken(true).then((token) => {
                        request.headers["Authorization"] = "Bearer " + token;
                        this.beginRequest(request).then((httpResponse: WebResponse) => {
                            deferred.resolve(httpResponse);
                        });
                    });
                } else {
                    deferred.resolve(httpResponse);
                }
            });

        });
        return deferred.promise;
    }

    private pollUri(request: WebRequest, prevDeferred?) {
        var deferred;
        if (prevDeferred) {
            deferred = prevDeferred;
        } else {
            deferred = Q.defer();
        }
        this.request(request).then((response: WebResponse) => {
            if (response.body.status === "InProgress") {
                sleepFor(this.longRunningOperationTimeout);
                this.pollUri(request, deferred);
            } else {
                deferred.resolve(response);
            }
        });
        return deferred.promise;
    }

    private pollUriStatus(request: WebRequest, prevDeferred?) {
        var deferred;
        if (prevDeferred) {
            deferred = prevDeferred;
        } else {
            deferred = Q.defer();
        }
        this.request(request).then((response: WebResponse) => {
            if (response.statusCode === 202) {
                sleepFor(this.longRunningOperationTimeout);
                this.pollUriStatus(request, deferred);
            } else {
                deferred.resolve(response);
            }
        });
        return deferred.promise;
    }

    public getLongRunningOperationResult(response: WebResponse) {
        var deferred = Q.defer();
        var uri = response.headers["azure-asyncoperation"];
        if (uri) {
            var request = new WebRequest();
            request.method = "GET";
            request.uri = uri;
            request.headers = {};
            this.pollUri(request).then((pollResponse) => {
                deferred.resolve(pollResponse);
            });
        } else {
            var res = new WebResponse();
            res.error = "Invalid Response Provided";
            deferred.resolve(res);
        }
        return deferred.promise;
    }

    public getLongRunningOperationStatus(response: WebResponse) {
        var deferred = Q.defer();
        var uri = response.headers["location"];
        if (uri) {
            var request = new WebRequest();
            request.method = "GET";
            request.uri = uri;
            request.headers = {};
            this.pollUriStatus(request).then((pollResponse) => {
                deferred.resolve(pollResponse);
            });
        } else {
            var res = new WebResponse();
            res.error = "Invalid Response Provided";
            deferred.resolve(res);
        }
        return deferred.promise;
    }
}
