"use strict";

import * as tl from "vsts-task-lib/task";
import * as url from "url";

import RegistryAuthenticationToken from "./registryauthenticationtoken"

export abstract class AuthenticationTokenProvider {
    // get registry login creds
    public abstract getAuthenticationToken(): RegistryAuthenticationToken

    protected getXMetaSourceClient(): string {
        var collectionUri: string = tl.getVariable('System.TeamFoundationCollectionUri');
        var collectionUrlObject = url.parse(collectionUri);
         if(collectionUrlObject.hostname.toUpperCase().endsWith(".VISUALSTUDIO.COM")) {
            return "VSTS";
         }
         
         return "TFS";
    }
}

export default AuthenticationTokenProvider;