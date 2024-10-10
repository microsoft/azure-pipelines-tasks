import { TokenCredential, AccessToken } from "@azure/identity";

export class ConnectedServiceTokenCredential implements TokenCredential {

    private _endpoint: any;
    private _audience: string;

    constructor(endpoint: any, audience: string) {

        this._endpoint = endpoint;

        this._audience = audience;
    }

    async getToken(): Promise<AccessToken> {
        this._endpoint.applicationTokenCredentials.activeDirectoryResourceId = this._audience;
        try {
            const token = await this._endpoint.applicationTokenCredentials.getToken(true);
            return {
                token: token,
                expiresOnTimestamp: Date.now() + (3600 * 1000)
            };
        } catch (error) {
            console.error('Error fetching token:', error);
            throw error; 
        }
    }
} 