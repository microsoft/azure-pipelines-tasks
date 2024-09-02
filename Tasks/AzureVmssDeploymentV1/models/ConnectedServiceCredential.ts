import { TokenCredential, AccessToken } from "@azure/identity";
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azureModels";

export class ConnectedServiceCredential implements TokenCredential {

    private _endpoint: AzureEndpoint;
    private _audience: string;

    constructor(endpoint: AzureEndpoint, audience: string) {

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