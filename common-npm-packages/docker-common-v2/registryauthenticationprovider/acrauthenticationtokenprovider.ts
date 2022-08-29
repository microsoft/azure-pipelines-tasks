"use strict";

import AuthenticationTokenProvider from "./authenticationtokenprovider";
import Q = require('q');
import RegistryAuthenticationToken from "./registryauthenticationtoken";
import * as tl from "azure-pipelines-task-lib/task";
import * as webClient from "../webClient";

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

    public async getToken(): Promise<RegistryAuthenticationToken> {
        let authType: string;
        // Will error out with an internal error if the parameter is not found. This error is determined inside of the
        // tl.getEndpointAuthorizationScheme/tl.getEndpointAuthorizationParameter and cannot be caught here as it is a
        // custom error.
        try {
            tl.debug("Attempting to get endpoint authorization scheme...");
            authType = tl.getEndpointAuthorizationScheme(this.endpointName, false);
        } catch (error) {
            tl.debug("Failed to get endpoint authorization scheme.")
        }
        if (!authType) {
            try {
                tl.debug("Attempting to get endpoint authorization scheme as an authorization parameter...");
                authType = tl.getEndpointAuthorizationParameter(this.endpointName, "scheme", false);
            } catch (error) {
                tl.debug("Failed to get endpoint authorization scheme as an authorization parameter. Will default authorization scheme to ServicePrincipal.");
                authType = "ServicePrincipal";
            }
        }
        if (authType == "ManagedServiceIdentity") {
            // Parameter 1: retryCount - the current retry count of the method to get the ACR token through MSI authentication
            // Parameter 2: timeToWait - the current time wait of the method to get the ACR token through MSI authentication
            return await this._getMSIAuthenticationToken(0, 0);
        } else {
            return this.getAuthenticationToken();
        }
    }

    private static _getACRToken(AADToken: string, endpointName: string, registryURL: string, retryCount: number, timeToWait: number): Q.Promise<string> {
        tl.debug("Attempting to convert ADD Token to an ACR token");
        let deferred = Q.defer<string>();
        let tenantID = tl.getEndpointAuthorizationParameter(endpointName, 'tenantid', true);
        let webRequest = new webClient.WebRequest();
        webRequest.method = "POST";
        const retryLimit = 5
        webRequest.uri = `https://${registryURL}/oauth2/exchange`;
        webRequest.body = (
            `grant_type=access_token&service=${registryURL}&tenant=${tenantID}&access_token=${AADToken}`
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
                        if (response.statusCode == 429) {
                            tl.debug("Too many requests were made to get ACR token. Retrying...");
                        } else {
                            tl.debug("Internal server error occurred. Retrying...")
                        }
                        let waitedTime = 2000 + timeToWait * 2;
                        retryCount += 1;
                        setTimeout(() => {
                            deferred.resolve(this._getACRToken(AADToken, endpointName, registryURL, retryCount, waitedTime));
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

    private static _getMSIAuthorizationToken(retyCount: number, timeToWait: number, baseUrl: string): Q.Promise<string> {
        tl.debug("Attempting to get AAD token using MSI authentication");
        var deferred = Q.defer<string>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = "GET";
        let apiVersion = "2018-02-01";
        const retryLimit = 5;
        webRequest.uri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + apiVersion + "&resource=" + baseUrl;
        webRequest.headers = {
            "Metadata": true
        };

        webClient.sendRequest(webRequest).then(
            (response: webClient.WebResponse) => {
                if (response.statusCode == 200) {
                    deferred.resolve(response.body.access_token);
                }
                else if (response.statusCode == 429 || response.statusCode == 500) {
                    if (retyCount < retryLimit) {
                        if (response.statusCode == 429) {
                            tl.debug("Too many requests were made to get AAD token. Retrying...");
                        } else {
                            tl.debug("Internal server error occurred. Retrying...")
                        }
                        let waitedTime = 2000 + timeToWait * 2;
                        retyCount += 1;
                        setTimeout(() => {
                            deferred.resolve(this._getMSIAuthorizationToken(retyCount, waitedTime, baseUrl));
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

    private async _getMSIAuthenticationToken(retryCount: number, timeToWait: number): Promise<RegistryAuthenticationToken> {
        if (this.registryURL && this.endpointName) {
            try {
                let aadtoken = await ACRAuthenticationTokenProvider._getMSIAuthorizationToken(
                    retryCount, timeToWait, "https://management.core.windows.net/");
                let acrToken = await ACRAuthenticationTokenProvider._getACRToken(aadtoken, this.endpointName, this.registryURL, retryCount, timeToWait);
                return new RegistryAuthenticationToken(
                    "00000000-0000-0000-0000-000000000000", acrToken, this.registryURL,
                    "ManagedIdentity@AzureRM", this.getXMetaSourceClient());
            } catch (error) {
                tl.debug("Unable to get registry authentication token with given registryURL. Please make sure that the MSI is correctly configured");
                throw new Error(tl.loc("MSIFetchError"));
            }
        }
        throw new Error(tl.loc("MSIFetchError"));
    }
}