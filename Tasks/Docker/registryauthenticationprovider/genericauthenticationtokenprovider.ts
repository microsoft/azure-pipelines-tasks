"use strict";

import RegistryAuthenticationToken from "./registryauthenticationtoken"
import AuthenticationTokenProvider from "./authenticationtokenprovider"
import * as tl from "vsts-task-lib/task";
import Q = require('q');

export default class GenericAuthenticationTokenProvider extends AuthenticationTokenProvider{

    private registryAuth: { [key: string]: string };
    
    constructor(endpointName?: string) {
        super();
        
        if(endpointName) {
            this.registryAuth = tl.getEndpointAuthorization(endpointName, true).parameters;
        }
    }
    
    public async getAuthenticationToken(): Promise<RegistryAuthenticationToken> {
        var deferred = Q.defer<RegistryAuthenticationToken>();
        if(this.registryAuth) {    
            deferred.resolve (new RegistryAuthenticationToken(this.registryAuth["username"], this.registryAuth["password"], this.registryAuth["registry"]));
        }
        
        deferred.resolve(null);
        return deferred.promise;
    }
}