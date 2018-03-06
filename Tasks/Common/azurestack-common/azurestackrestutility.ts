import tl = require('vsts-task-lib/task');
import Q = require('q');
import * as rm from "typed-rest-client/RestClient";
import httpInterfaces = require("typed-rest-client/Interfaces");

let proxyUrl: string = tl.getVariable("agent.proxyurl"); 
var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? { 
    proxy: { 
        proxyUrl: proxyUrl, 
        proxyUsername: tl.getVariable("agent.proxyusername"), 
        proxyPassword: tl.getVariable("agent.proxypassword"), 
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null 
    } 
} : {}; 

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";
let rc = new rm.RestClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, null, requestOptions);

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
            endPoint =  await initializeAzureStackData(endPoint);
            endPoint["envAuthUrl"] = endPoint['environmentAuthorityUrl'];
            endPoint["activeDirectoryResourceId"] = endPoint['activeDirectoryServiceEndpointResourceId'];
            
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
    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.get(azureStackDependencyDataUrl, options);
    promise.then((response) => {
        if(response.statusCode === 200) {
            let result = response.result;
            var authenticationData = result.authentication;
            if(authenticationData) {
                var loginEndpoint = authenticationData.loginEndpoint;
                if(loginEndpoint) {
                    loginEndpoint += (loginEndpoint.lastIndexOf("/") == loginEndpoint.length - 1) ? "" : "/";
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
            
            if(result.graphEndpoint) {
                endpoint['graphUrl'] = result.graphEndpoint;
            }
            
            if(result.galleryUrl) {
                endpoint['galleryUrl'] = result.galleryUrl;
            }
            
            if(result.portalEndpoint) {
                endpoint['portalEndpoint'] = result.portalEndpoint;
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
            tl.debug("Action: initializeAzureStackData, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("FailedToFetchAzureStackDependencyData", response.statusCode));
        }
    },
    (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}