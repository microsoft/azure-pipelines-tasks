"use strict";

import RegistryAuthenticationToken from "./registryauthenticationtoken"
import Q = require('q');

export abstract class AuthenticationTokenProvider {
    // get registry login creds
    public abstract async getAuthenticationToken(): Promise<RegistryAuthenticationToken>
}

export default AuthenticationTokenProvider;