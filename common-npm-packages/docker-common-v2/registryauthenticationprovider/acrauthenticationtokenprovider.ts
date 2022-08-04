"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as Q from "q";
import * as webClient from "./webClient";
import RegistryAuthenticationToken from "./registryauthenticationtoken"
import AuthenticationTokenProvider from "./authenticationtokenprovider"

export default class ACRAuthenticationTokenProvider extends AuthenticationTokenProvider{

    // URL to registry like jitekuma-microsoft.azurecr.io
    private registryURL: string;

    // name of the azure subscription endpoint like RMDev
    private endpointName: string;

    // ACR fragment like /subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/jitekuma-RG/providers/Microsoft.ContainerRegistry/registries/jitekuma
    private acrFragmentUrl: string;

    constructor(endpointName?: string, registerNameValue?: string) {
        super();

        if(endpointName && registerNameValue) 
        {
            try
            {
              tl.debug("Reading the acr registry in old versions");
              var obj = JSON.parse(registerNameValue);  
              this.registryURL = obj.loginServer;
              this.acrFragmentUrl = obj.id;
            }  
            catch(e)
            {
              tl.debug("Reading the acr registry in kubernetesV1");
              this.registryURL = registerNameValue;
            }
  
            this.endpointName = endpointName;
        }
    }
    
    public getAuthenticationToken(): RegistryAuthenticationToken
    {
        if(this.registryURL && this.endpointName) {      
            return new RegistryAuthenticationToken(tl.getEndpointAuthorizationParameter(this.endpointName, 'serviceprincipalid', true), tl.getEndpointAuthorizationParameter(this.endpointName, 'serviceprincipalkey', true), this.registryURL, "ServicePrincipal@AzureRM", this.getXMetaSourceClient());
        }

        return null;
    }

    private _getACRToken(AADToken: string, retryCount: number, timeToWait: number): Q.Promise<string> {
        let deferred = Q.defer<string>();
        let tenantID = tl.getEndpointAuthorizationParameter(this.endpointName, 'tenantid', true);
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        const retryLimit = 5
        webRequest.uri = `https://${this.registryURL}/oauth2/exchange`;
        // grant_type=access_token&service=$registry&tenant=$tenant&access_token=$aad_access_token
        webRequest.body = (
            `grant_type=access_token&service=${this.registryURL}&tenant=${tenantID}&access_token=${AADToken}`
        );
        webRequest.headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        };
        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode === 200) {
                    deferred.resolve(response.body.refresh_token);
                }
                else if (response.statusCode == 429 || response.statusCode == 500) {
                    if (retryCount < retryLimit) {
                        let waitedTime = 2000 + timeToWait * 2;
                        retryCount += 1;
                        setTimeout(() => {
                            deferred.resolve(this._getACRToken(AADToken, retryCount, waitedTime));
                        }, waitedTime);
                    }
                    else {
                        deferred.reject(tl.loc('CouldNotFetchAccessTokenforACRStatusCode', response.statusCode, response.statusMessage));
                    }

                }
                else {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIDueToACRNotConfiguredProperlyStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );
        return deferred.promise;
    }

    private async _getMSIAuthenticationToken(retryCount: number, timeToWait: number): Promise<string> {
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        let baseURL = "https://management.core.windows.net/";
        webRequest.method = "GET";
        let apiVersion = "2018-02-01";
        const retryLimit = 5;
        webRequest.uri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + apiVersion + "&resource=" + baseURL;
        webRequest.headers = {
            "Metadata": true
        };
        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if (response.statusCode == 429 || response.statusCode == 500) {
                    if (retryCount < retryLimit) {
                        let waitedTime = 2000 + timeToWait * 2;
                        retryCount += 1;
                        setTimeout(() => {
                            deferred.resolve(this._getMSIAuthenticationToken(retryCount, waitedTime));
                        }, waitedTime);
                    }
                    else {
                        deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIStatusCode', response.statusCode, response.statusMessage));
                    }

                }
                else {
                    deferred.reject(tl.loc('CouldNotFetchAccessTokenforMSIDueToMSINotConfiguredProperlyStatusCode', response.statusCode, response.statusMessage));
                }
            },
            (error) => {
                deferred.reject(error)
            }
        );
        return deferred.promise;
    }

    public async getMSIAuthenticationToken(retryCount: number, timeToWait: number): Promise<RegistryAuthenticationToken> {
        if (this.registryURL && this.endpointName) {
            let aadtoken = await this._getMSIAuthenticationToken(retryCount, timeToWait);
            let acrToken = await this._getACRToken(aadtoken, retryCount, timeToWait);
            return new RegistryAuthenticationToken("00000000-0000-0000-0000-000000000000", acrToken, this.registryURL, "ManagedIdentity@AzureRM", this.getXMetaSourceClient());
        }
        return null;
    }
}