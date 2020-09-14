"use strict";

import * as tl from "vsts-task-lib/task";
import * as url from "url";

import RegistryAuthenticationToken from "./registryauthenticationtoken"

export abstract class AuthenticationTokenProvider {
    // get registry login creds
    public abstract getAuthenticationToken(): RegistryAuthenticationToken

    protected getXMetaSourceClient(): string {
        var serverType = tl.getVariable('System.ServerType');       
        return (serverType && serverType.toLowerCase() === "hosted") ? "VSTS" : "TFS";
    }
}

export default AuthenticationTokenProvider;