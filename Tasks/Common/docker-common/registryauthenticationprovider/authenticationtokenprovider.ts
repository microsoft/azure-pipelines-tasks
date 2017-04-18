"use strict";

import RegistryAuthenticationToken from "./registryauthenticationtoken"

export abstract class AuthenticationTokenProvider {
    // get registry login creds
    public abstract getAuthenticationToken(): RegistryAuthenticationToken
}

export default AuthenticationTokenProvider;