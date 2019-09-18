"use strict";

import RegistryAuthenticationToken from "./registryauthenticationtoken"
import AuthenticationTokenProvider from "./authenticationtokenprovider"
import * as tl from "azure-pipelines-task-lib/task";

export default class GenericAuthenticationTokenProvider extends AuthenticationTokenProvider{

    private registryAuth: { [key: string]: string };
    
    constructor(endpointName?: string) {
        super();
        
        if(endpointName) {
            this.registryAuth = tl.getEndpointAuthorization(endpointName, false).parameters;
        }
    }
    
    public getAuthenticationToken(): RegistryAuthenticationToken {
        
        if(this.registryAuth) {    
            return new RegistryAuthenticationToken(this.registryAuth["username"], this.registryAuth["password"], this.registryAuth["registry"], this.registryAuth["email"], this.getXMetaSourceClient());
        }
        
        return null;
    }
}