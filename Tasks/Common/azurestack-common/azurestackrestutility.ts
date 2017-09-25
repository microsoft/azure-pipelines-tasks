var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestCallbackClient(httpObj);

var azureStackEnvironment = "AzureStack";
var defaultAuthorityUrl = "https://login.windows.net/";

export async function initializeAzureRMEndpointData(connectedServiceName)
{
    var endPoint = new Array();
    endPoint["servicePrincipalClientID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalid', false);
    endPoint["servicePrincipalKey"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalkey', false);
    endPoint["tenantID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'tenantid', false);
    endPoint["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
    endPoint["envAuthUrl"] = tl.getEndpointDataParameter(connectedServiceName, 'environmentAuthorityUrl', true);
    endPoint["url"] = tl.getEndpointUrl(connectedServiceName, true);
    endPoint["environment"] = tl.getEndpointDataParameter(connectedServiceName, 'environment', true);
    endPoint["activeDirectoryResourceId"] = tl.getEndpointDataParameter(connectedServiceName, 'activeDirectoryServiceEndpointResourceId', true);

    if(endPoint["environment"] != null && endPoint["environment"].toLowerCase() == azureStackEnvironment.toLowerCase()) {
        if(!endPoint["envAuthUrl"] || !endPoint["activeDirectoryResourceId"]) {
            endPoint =  await initializeAzureStackData({"url":endPoint["url"]});
            
            if(endPoint["envAuthUrl"] == null) {
                throw tl.loc("UnableToFetchAuthorityURL");
            }

            if(endPoint["activeDirectoryResourceId"] == null) {
                throw tl.loc("UnableToFetchActiveDirectory");
            }
        } 
    } else {
        endPoint["envAuthUrl"] = (endPoint["envAuthUrl"] != null) ? endPoint["envAuthUrl"] : defaultAuthorityUrl;
        endPoint["activeDirectoryResourceId"] = endPoint["url"];
    }

    return endPoint;
}

export async function initializeAzureStackData(endpoint): Promise<any>
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
                    if(audiences.length > 0) {
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
            
            var endpointUrl =  endpoint.url;
            endpointUrl += (endpointUrl.lastIndexOf("/") == endpointUrl.length-1) ? "":"/";
            var domain = "";
            try {
                var index = endpointUrl.indexOf('.');
                domain = endpointUrl.substring(index+1);
                domain = (domain.lastIndexOf("/") == domain.length-1) ? domain.substring(0, domain.length-1): domain;
            } catch(error) {
                deferred.reject(tl.loc("SpecifiedAzureRmEndpointIsInvalid", endpointUrl));
            }

            endpoint['AzureKeyVaultDnsSuffix'] = ("vault" + domain).toLowerCase();
            endpoint['AzureKeyVaultServiceEndpointResourceId'] = ("https://vault." + domain).toLowerCase();
            deferred.resolve(endpoint);
        }
        else {
            tl.debug(body);
            deferred.reject(tl.loc("FailedToFetchAzureStackDependencyData", response.statusMessage));
        }
    });
    return deferred.promise;
}