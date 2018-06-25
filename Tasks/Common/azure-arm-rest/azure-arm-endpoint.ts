import tl = require('vsts-task-lib/task');
import Q = require('q');
import webClient = require("./webClient");
import { AzureEndpoint } from "./azureModels";
import { ApplicationTokenCredentials } from './azure-arm-common';
import constants = require('./constants');

export class AzureRMEndpoint {
    public endpoint: AzureEndpoint;
    private _connectedServiceName: string;
    private applicationTokenCredentials: ApplicationTokenCredentials;

    // Add an entry here and separate function for each new environment
    private _environments = {
        'AzureStack': 'azurestack'
    }

    constructor(connectedServiceName: string) {
        this._connectedServiceName = connectedServiceName;
        this.endpoint = null;
    }

    public async getEndpoint(): Promise<AzureEndpoint> {
        if(!!this.endpoint) {
            return this.endpoint;
        }
        else {
            this.endpoint = {
                subscriptionID: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionid', true),
                subscriptionName: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionname', true),
                servicePrincipalClientID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'serviceprincipalid', true),
                servicePrincipalKey: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'serviceprincipalkey', true),
                environmentAuthorityUrl: tl.getEndpointDataParameter(this._connectedServiceName, 'environmentAuthorityUrl', true),
                tenantID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'tenantid', false),
                url: tl.getEndpointUrl(this._connectedServiceName, true),
                environment: tl.getEndpointDataParameter(this._connectedServiceName, 'environment', true),
                scheme: tl.getEndpointAuthorizationScheme(this._connectedServiceName, true),
                msiClientId:  tl.getEndpointDataParameter(this._connectedServiceName, 'msiclientId', true),
                activeDirectoryResourceID: tl.getEndpointDataParameter(this._connectedServiceName, 'activeDirectoryServiceEndpointResourceId', true)
            } as AzureEndpoint;

            if(!!this.endpoint.environment && this.endpoint.environment.toLowerCase() == this._environments.AzureStack) {
                if(!this.endpoint.environmentAuthorityUrl || !this.endpoint.activeDirectoryResourceID) {
                    this.endpoint = await this._updateAzureStackData(this.endpoint);
                }
            }
            else {
                this.endpoint.environmentAuthorityUrl = (!!this.endpoint.environmentAuthorityUrl) ? this.endpoint.environmentAuthorityUrl : "https://login.windows.net/";
                this.endpoint.activeDirectoryResourceID = this.endpoint.url;
            }

            this.endpoint.applicationTokenCredentials = new ApplicationTokenCredentials(this.endpoint.servicePrincipalClientID, this.endpoint.tenantID, this.endpoint.servicePrincipalKey, 
                this.endpoint.url, this.endpoint.environmentAuthorityUrl, this.endpoint.activeDirectoryResourceID, !!this.endpoint.environment && this.endpoint.environment.toLowerCase() == constants.AzureEnvironments.AzureStack, this.endpoint.scheme, this.endpoint.msiClientId);
        }

        return this.endpoint;
    }

    private async _updateAzureStackData(endpoint: AzureEndpoint): Promise<AzureEndpoint> {
        let dataDeferred = Q.defer<AzureEndpoint>();
        let webRequest = new webClient.WebRequest();
        webRequest.uri = `${endpoint.url}metadata/endpoints?api-version=2015-01-01`;
        webRequest.method = 'GET';
        webRequest.headers = {
            'Content-Type': 'application/json'
        }

        let azureStackResult;
        try {
            let response: webClient.WebResponse = await webClient.sendRequest(webRequest);
            if(response.statusCode != 200) {
                tl.debug("Action: _updateAzureStackData, Response: " + JSON.stringify(response));
                throw new Error(response.statusCode + ' ' + response.statusMessage)
            }

            azureStackResult = response.body;
        }
        catch(error) {
            throw new Error(tl.loc("FailedToFetchAzureStackDependencyData", error.toString()));
        }

        endpoint.graphEndpoint = azureStackResult.graphEndpoint;
        endpoint.galleryUrl = azureStackResult.galleryUrl;
        endpoint.portalEndpoint = azureStackResult.portalEndpoint;
        var authenticationData = azureStackResult.authentication;
        if(!!authenticationData) {
            var loginEndpoint = authenticationData.loginEndpoint;
            if(!!loginEndpoint) {
                loginEndpoint += (loginEndpoint[loginEndpoint.length - 1] == "/") ? "" : "/";
                endpoint.activeDirectoryAuthority = loginEndpoint;
                endpoint.environmentAuthorityUrl = loginEndpoint;
            }
            else {
                // change to login endpoint
                throw new Error(tl.loc('UnableToFetchAuthorityURL'));
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
                throw new Error(tl.loc("SpecifiedAzureRmEndpointIsInvalid", endpointUrl));
            }
        }

        return endpoint;
    }
}