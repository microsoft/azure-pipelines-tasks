/// <reference types="q" />
import Q = require('q');
export declare class ApplicationTokenCredentials {
    private clientId;
    private domain;
    private authType;
    private secret?;
    private accessToken?;
    private certFilePath?;
    private isADFSEnabled?;
    baseUrl: string;
    authorityUrl: string;
    activeDirectoryResourceId: string;
    isAzureStackEnvironment: boolean;
    scheme: number;
    msiClientId: string;
    private token_deferred;
    constructor(clientId: string, domain: string, secret: string, baseUrl: string, authorityUrl: string, activeDirectoryResourceId: string, isAzureStackEnvironment: boolean, scheme?: string, msiClientId?: string, authType?: string, certFilePath?: string, isADFSEnabled?: boolean, access_token?: string);
    getToken(force?: boolean): Q.Promise<string>;
    getDomain(): string;
    getClientId(): string;
    public static getMSIAuthorizationToken(retyCount, timeToWait, baseUrl, msiClientId?);
    private _getSPNAuthorizationToken();
    private _getSPNAuthorizationTokenFromCertificate();
    private _getSPNAuthorizationTokenFromKey();
    private _getSPNCertificateAuthorizationToken();
}
