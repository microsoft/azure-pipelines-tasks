export interface IExternalPackageSource {
    /**
     * The protocol-specific URI used to access the package source
     */
    uri: string;
}
export interface IAdditionalData {
    [x: string]: string;
}
export declare abstract class ServiceConnection {
    packageSource: IExternalPackageSource;
    authType: ServiceConnectionAuthType;
    additionalData: IAdditionalData;
    constructor(packageSource: IExternalPackageSource, authType: ServiceConnectionAuthType, additionalData?: IAdditionalData);
}
export declare class TokenServiceConnection extends ServiceConnection {
    packageSource: IExternalPackageSource;
    token: string;
    additionalData: IAdditionalData;
    constructor(packageSource: IExternalPackageSource, token: string, additionalData?: IAdditionalData);
}
export declare class UsernamePasswordServiceConnection extends ServiceConnection {
    packageSource: IExternalPackageSource;
    username: string;
    password: string;
    additionalData: IAdditionalData;
    constructor(packageSource: IExternalPackageSource, username: string, password: string, additionalData?: IAdditionalData);
}
export declare class ApiKeyServiceConnection extends ServiceConnection {
    packageSource: IExternalPackageSource;
    apiKey: string;
    additionalData: IAdditionalData;
    constructor(packageSource: IExternalPackageSource, apiKey: string, additionalData?: IAdditionalData);
}
export declare class PrivateKeyServiceConnection extends ServiceConnection {
    packageSource: IExternalPackageSource;
    privateKey: string;
    passphrase: string;
    additionalData: IAdditionalData;
    constructor(packageSource: IExternalPackageSource, privateKey: string, passphrase: string, additionalData?: IAdditionalData);
}
export declare enum ServiceConnectionAuthType {
    Token = 0,
    UsernamePassword = 1,
    ApiKey = 2,
    PrivateKey = 3,
}
/**
 * Parses service connections / service endpoints from a task input into strongly typed objects containing the URI and credentials.
 *
 * @param endpointsInputName The name of the task input containing the service connections endpoints
 */
export declare function getPackagingServiceConnections(endpointsInputName: string, dataParameters?: string[]): ServiceConnection[];
