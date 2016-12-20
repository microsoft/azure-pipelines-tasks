var httpClient = require('vso-node-api/HttpClient');
var restClient = require('vso-node-api/RestClient');
import Q = require("q");
var uuid = require('uuid');

var httpCallbackClient = new httpClient.HttpCallbackClient("VSTS_AGENT");
var restObj = new restClient.RestCallbackClient(httpCallbackClient);

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
}

export class ServiceClient {
    private credentials;
    constructor(credentials) {
        this.credentials = credentials;
    }

    private makeResponse(error, response, body) {
        var res = new WebResponse();
        if (error) {
            error = JSON.parse(error);
            res.error = error;
        }
        res.statusCode = response.statusCode;
        try {
            res.body = JSON.parse(body);
        } catch (error) {
            res.error = error;
        }
        return res;
    }

    private beginGet(request: WebRequest) {
        var deferred = Q.defer<WebResponse>();
        httpCallbackClient.send('GET', request.uri, request.body, request.headers, (error, response, body) => {
            var HttpResponse = this.makeResponse(error, response, body);
            deferred.resolve(HttpResponse);
        });
        return deferred.promise;
    }

    public get(request: WebRequest): Q.Promise<WebResponse> {
        var deferred = Q.defer<WebResponse>();
        this.credentials.getToken().then((token) => {
            request.headers["Authorization"] = "Bearer " + token;
            this.beginGet(request).then((httpResponse: WebResponse) => {
                // If token expires, generate a new token
                if (httpResponse.statusCode === 401 && httpResponse.body.error.code === "ExpiredAuthenticationToken") {
                    this.credentials.getToken(true).then((token) => {
                        request.headers["Authorization"] = "Bearer " + token;
                        this.beginGet(request).then((httpResponse: WebResponse) => {
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

}
