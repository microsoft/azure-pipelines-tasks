import RegistryAuthenticationToken from "./registryauthenticationtoken";
import AuthenticationTokenProvider from "./authenticationtokenprovider";
export default class ACRAuthenticationTokenProvider extends AuthenticationTokenProvider {
    private registryURL;
    private endpointName;
    private acrFragmentUrl;
    constructor(endpointName?: string, registerNameValue?: string);
    getAuthenticationToken(): RegistryAuthenticationToken;
}
