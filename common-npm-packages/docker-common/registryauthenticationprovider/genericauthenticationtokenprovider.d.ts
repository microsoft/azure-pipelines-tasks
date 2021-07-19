import RegistryAuthenticationToken from "./registryauthenticationtoken";
import AuthenticationTokenProvider from "./authenticationtokenprovider";
export default class GenericAuthenticationTokenProvider extends AuthenticationTokenProvider {
    private registryAuth;
    constructor(endpointName?: string);
    getAuthenticationToken(): RegistryAuthenticationToken;
}
