import tl = require('vsts-task-lib/task');
import Q = require('q');
import webClient = require("./webClient");
import { AzureEndpoint } from "./azureModels";
export class AzureRMEndpoint {
    public _endpoint: AzureEndpoint;
    private _connectedServiceName: string;
    // Add an entry here and separate function for each new environment
    private _environments = {
        'AzureStack': 'azurestack'
    }

    constructor(connectedServiceName: string) {
        this._connectedServiceName = connectedServiceName;
        this._endpoint = null;
    }

    public getEndpoint() {
        let dataDeferred = Q.defer<AzureEndpoint>();
        if(!!this._endpoint) {
            dataDeferred.resolve(this._endpoint);
        }
        else {
            this._endpoint = {
                subscriptionID: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionid', true),
                subscriptionName: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionname', true),
                servicePrincipalClientID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'serviceprincipalid', false),
                servicePrincipalKey: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'serviceprincipalkey', false),
                environmentAuthorityUrl: tl.getEndpointDataParameter(this._connectedServiceName, 'environmentAuthorityUrl', true),
                tenantID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'tenantid', false),
                url: tl.getEndpointUrl(this._connectedServiceName, true),
                environment: tl.getEndpointDataParameter(this._connectedServiceName, 'environment', true),
                activeDirectoryResourceID: tl.getEndpointDataParameter(this._connectedServiceName, 'activeDirectoryServiceEndpointResourceId', true)
            } as AzureEndpoint;

            // Initialize Azure Endpoint for specific environment
            switch(this._endpoint.environment.toLowerCase()) {
                case this._environments.AzureStack: {
                    this._getAzureStackData(this._endpoint).then((endpoint) => {
                        dataDeferred.resolve(endpoint);
                    }, (error) => {
                        dataDeferred.reject(error);
                    })
                    break;
                }
                default: {
                    this._endpoint.environmentAuthorityUrl = (!!this._endpoint.environmentAuthorityUrl) ? this._endpoint.environmentAuthorityUrl : "https://login.windows.net/";
                    this._endpoint.activeDirectoryResourceID = this._endpoint.url;
                    dataDeferred.resolve(this._endpoint);
                }
            }
        }

        return dataDeferred.promise;
    
    }

    private _getAzureStackData(endpoint: AzureEndpoint) {
        let dataDeferred = Q.defer<AzureEndpoint>();
        let webRequest = new webClient.WebRequest();
        webRequest.uri = `${endpoint.url}metadata/endpoints?api-version=2015-01-01`;
        webRequest.method = 'GET';
        webRequest.headers = {
            'Content-Type': 'application/json'
        }

        webClient.sendRequest(webRequest).then((response: webClient.WebResponse) => {
            if(response.statusCode == 200) {
                let result = response.body;
                endpoint.graphEndpoint = result.graphEndpoint;
                endpoint.galleryUrl = result.galleryUrl;
                endpoint.portalEndpoint = result.portalEndpoint;
                var authenticationData = result.authentication;
                if(!!authenticationData) {
                    var loginEndpoint = authenticationData.loginEndpoint;
                    if(!!loginEndpoint) {
                        loginEndpoint += (loginEndpoint[loginEndpoint.length - 1] == "/") ? "" : "/";
                        endpoint.activeDirectoryAuthority = loginEndpoint;
                        endpoint.environmentAuthorityUrl = loginEndpoint;
                    }
                    else {
                        // change to login endpoint
                        dataDeferred.reject(tl.loc('UnableToFetchAuthorityURL'));
                    }

                    var audiences = authenticationData.audiences;
                    if(audiences && audiences.length > 0) {
                        endpoint.activeDirectoryResourceID = audiences[0];
                    }

                    try {
                        var endpointUrl =  endpoint.url;
                        endpointUrl += (endpointUrl[endpointUrl.length-1] == "/") ? "" : "/";
                        var index = endpointUrl.indexOf('.');
                        var domain = endpointUrl.substring(index+1);
                        domain = (domain.lastIndexOf("/") == domain.length-1) ? domain.substring(0, domain.length-1): domain;
                        endpoint.AzureKeyVaultDnsSuffix = ("vault" + domain).toLowerCase();
                        endpoint.AzureKeyVaultServiceEndpointResourceId = ("https://vault." + domain).toLowerCase();
                    }
                    catch(error) {
                        dataDeferred.reject(tl.loc("SpecifiedAzureRmEndpointIsInvalid", endpointUrl));
                    }

                    dataDeferred.resolve(endpoint);
                }

            }
            else {
                tl.debug("Action: initializeAzureStackData, Response: " + JSON.stringify(response));
                dataDeferred.reject(tl.loc("FailedToFetchAzureStackDependencyData", response.statusCode));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });
        
        return dataDeferred.promise;
    }
}