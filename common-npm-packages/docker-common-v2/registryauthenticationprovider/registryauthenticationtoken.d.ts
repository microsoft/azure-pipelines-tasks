export default class RegistryServerAuthenticationToken {
    private registry;
    private username;
    private password;
    private email;
    private xMetaSourceClient;
    constructor(username: string, authenticationPassword: string, registry: string, email: string, xMetaSourceClient: string);
    getUsername(): string;
    getPassword(): string;
    getLoginServerUrl(): string;
    getEmail(): string;
    getDockerConfig(): string;
    getDockerAuth(): string;
}
export declare function getDockerRegistryEndpointAuthenticationToken(endpointId: string): RegistryServerAuthenticationToken;
