var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');
var deasync = require('deasync');

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestCallbackClient(httpObj);

export async function initializeAzureStackData(endpoint)
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
            var authenticationData = obj.authentication;
            if(authenticationData) {
                var loginEndpoint = authenticationData.loginEndpoint;
                if(loginEndpoint) {
                    endpoint['activeDirectoryAuthority'] = loginEndpoint;
                    endpoint['environmentAuthorityUrl'] = loginEndpoint;
                }

                var audiences = authenticationData.audiences;
                if(audiences) {
                    if(audiences.lenth > 0) {
                        endpoint['activeDirectoryServiceEndpointResourceId'] = audiences[0];
                    }
                }
            }
            
            if(obj.graphEndpoint) {
                endpoint['graphUrl'] = obj.graphEndpoint;
            }
            
            if(obj.galleryUrl) {
                endpoint['galleryUrl'] = obj.galleryUrl;
            }
            
            if(obj.portalEndpoint) {
                endpoint['portalEndpoint'] = obj.portalEndpoint;
            }
            
            deferred.resolve(endpoint);
        }
        else {
            tl.debug(body);
            deferred.reject(response.statusMessage);
        }
    });
    return deferred.promise;
}