import RegistryAuthenticationToken from "./registryauthenticationtoken";
export declare abstract class AuthenticationTokenProvider {
    abstract getAuthenticationToken(): RegistryAuthenticationToken;
    protected getXMetaSourceClient(): string;
}
export default AuthenticationTokenProvider;
