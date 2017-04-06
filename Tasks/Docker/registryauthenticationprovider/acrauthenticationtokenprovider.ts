"use strict";

import * as tl from "vsts-task-lib/task";
import RegistryAuthenticationToken from "./registryauthenticationtoken"
import AuthenticationTokenProvider from "./authenticationtokenprovider"
var azureRmUtil = require('azurerest-common/azurerestutility');
import Q = require('q');

export default class ACRAuthenticationTokenProvider extends AuthenticationTokenProvider{

    // URL to registry like jitekuma-microsoft.azurecr.io
    private registryURL: string;

    // name of the azure subscription endpoint like RMDev
    private endpointName: string;

    // ACR fragment like /subscriptions/c00d16c7-6c1f-4c03-9be1-6934a4c49682/resourcegroups/jitekuma-RG/providers/Microsoft.ContainerRegistry/registries/jitekuma
    private acrFragmentUrl: string;

    constructor(endpointName?: string, registerNameValue?: string) {
        super();

        if(endpointName && registerNameValue) {
            var obj = JSON.parse(registerNameValue);
            this.registryURL = obj.loginServer;
            this.acrFragmentUrl = obj.id;
            this.endpointName = endpointName;
        }
    }
    
    public async getAuthenticationToken(): Promise<RegistryAuthenticationToken>
    {
        var deferred = Q.defer<RegistryAuthenticationToken>();

        if(this.registryURL && this.endpointName && this.acrFragmentUrl) {    
            
            var endPoint = new Array();
            endPoint["servicePrincipalClientID"] = tl.getEndpointAuthorizationParameter(this.endpointName, 'serviceprincipalid', true);
            endPoint["servicePrincipalKey"] = tl.getEndpointAuthorizationParameter(this.endpointName, 'serviceprincipalkey', true);
            endPoint["tenantID"] = tl.getEndpointAuthorizationParameter(this.endpointName, 'tenantid', true);
            endPoint["subscriptionId"] = tl.getEndpointDataParameter(this.endpointName, 'subscriptionid', true);
            endPoint["envAuthUrl"] = tl.getEndpointDataParameter(this.endpointName, 'environmentAuthorityUrl', true);
            endPoint["url"] = tl.getEndpointUrl(this.endpointName, true);

           azureRmUtil.getAzureContainerRegistryCredentials(endPoint, this.acrFragmentUrl).then((value) => {

               try {
                    deferred.resolve (new RegistryAuthenticationToken(value.username, value.passwords[0].value, this.registryURL));  
               }catch(Error) {
                     deferred.reject(Error);
               }
            },
            function failure(value) {
                tl.error(value);
                deferred.reject(value);
            })
        }
        else {
            deferred.resolve(null)
        }

        return deferred.promise;
    }
}