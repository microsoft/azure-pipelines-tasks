import * as tl from "azure-pipelines-task-lib/task";
import { TokenCredential, AccessToken } from "@azure/identity";
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azureModels";

export class ConnectedServiceCredential implements TokenCredential {

    private _endpoint: AzureEndpoint;
    private _audience: string;

    constructor(endpoint: AzureEndpoint, audience: string) {

        this._endpoint = endpoint;

        this._audience = audience;
    }

    async getToken(scopes: string | string[]): Promise<AccessToken> {
        const requestedScopes: string[] = Array.isArray(scopes) ? scopes : [scopes];
        if (requestedScopes.length !== 1
            || typeof requestedScopes[0] !== "string"
            || !requestedScopes[0].startsWith(`${this._audience}/`)) {
            throw new Error(tl.loc("InvalidCredentialScope"));
        }

        this._endpoint.applicationTokenCredentials.activeDirectoryResourceId = this._audience;

        // https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes
        return {
            token: await this._endpoint.applicationTokenCredentials.getToken(true), // force will result in a new token being fetched instead of cached token
            expiresOnTimestamp: Date.now() + (3600 * 1000)
        };
    }
}