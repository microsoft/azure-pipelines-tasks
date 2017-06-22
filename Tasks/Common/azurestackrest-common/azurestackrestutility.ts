var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestCallbackClient(httpObj);

export async function populateAzureRmDependencyData(endpoint)
{
    var deferred = Q.defer<any>();
    var headers = {
        'Content-Type': 'application/json'
    };
     
    var azureStackDependencyDataUrl = endpoint.url + "/metadata/endpoints?api-version=2015-01-01"

    httpObj.get('GET', azureStackDependencyDataUrl, headers, (error, response, body) => {
        if (error) {
            deferred.reject(error);
        }
        else if (response.statusCode === 200) {
            var obj = JSON.parse(body);
            endpoint.data['activeDirectoryAuthority'] = obj.authentication.loginEndpoint;
            endpoint.data['environmentAuthorityUrl'] = obj.authentication.loginEndpoint;
            endpoint.data['graphUrl'] = obj.graphEndpoint;
            endpoint.data['galleryUrl'] = obj.galleryUrl;
            deferred.resolve(endpoint);
        }
        else {
            tl.debug(body);
            deferred.reject(response.statusMessage);
        }
    });
    return deferred.promise;
}