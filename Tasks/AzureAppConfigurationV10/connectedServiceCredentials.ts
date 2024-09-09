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

        // https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes
        return {
            token: await this._endpoint.applicationTokenCredentials.getToken(true), // force will result in a new token being fetched instead of cached token
            expiresOnTimestamp: Date.now() + (3600 * 1000)
        };
    }
}