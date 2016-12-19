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

export class ServiceClient {
    private credentials;
    constructor(credentials) {
        this.credentials = credentials;
    }

    public get(request: WebRequest):Q.Promise<any> {
        var deferred = Q.defer<any>();
        this.credentials.getToken().then((token) => {
            httpCallbackClient.send('GET', request.uri, request.body, request.headers,  (error, response, body) => {
                if(error) {
                    deferred.reject(error);
                }
                deferred.resolve(response);
            });
        });
        return deferred.promise;
    }

}

/*client.pipeline(httpRequest, function (err, response, responseBody) {
            if (err) {
            return callback(err);
            }
            var statusCode = response.statusCode;
            if (statusCode !== 204 && statusCode !== 404) {
            var error = new Error(responseBody);
            error.statusCode = response.statusCode;
            error.request = msRest.stripRequest(httpRequest);
            error.response = msRest.stripResponse(response);
            if (responseBody === '') responseBody = null;
            var parsedErrorResponse;
            try {
                parsedErrorResponse = JSON.parse(responseBody);
                if (parsedErrorResponse) {
                if (parsedErrorResponse.error) parsedErrorResponse = parsedErrorResponse.error;
                if (parsedErrorResponse.code) error.code = parsedErrorResponse.code;
                if (parsedErrorResponse.message) error.message = parsedErrorResponse.message;
                }
                if (parsedErrorResponse !== null && parsedErrorResponse !== undefined) {
                var resultMapper = new client.models['CloudError']().mapper();
                error.body = client.deserialize(resultMapper, parsedErrorResponse, 'error.body');
                }
            } catch (defaultError) {
                error.message = util.format('Error "%s" occurred in deserializing the responseBody ' + 
                                '- "%s" for the default response.', defaultError.message, responseBody);
                return callback(error);
            }
            return callback(error);
            }
            // Create Result
            var result = null;
            if (responseBody === '') responseBody = null;
            result = (statusCode === 204);

            return callback(null, result, httpRequest, response);
        }); 
*/