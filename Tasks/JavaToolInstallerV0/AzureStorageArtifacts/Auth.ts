import * as tl from "azure-pipelines-task-lib/task";
import * as msal from "@azure/msal-node";
import { getFederatedToken } from "azure-pipelines-tasks-artifacts-common/webapi";
import { ClientSecretCredential } from "@azure/identity";

export async function getAccessTokenViaWorkloadIdentityFederation(connectedService: string): Promise<ClientSecretCredential> {
    // Validate authorization scheme
    const authorizationScheme = tl.getEndpointAuthorizationSchemeRequired(connectedService).toLowerCase();
    if (authorizationScheme !== "workloadidentityfederation") {
        throw new Error(`Authorization scheme ${authorizationScheme} is not supported.`);
    }

    // Fetch necessary parameters
    const servicePrincipalId = tl.getEndpointAuthorizationParameterRequired(connectedService, "serviceprincipalid");
    const servicePrincipalTenantId = tl.getEndpointAuthorizationParameterRequired(connectedService, "tenantid");
    const authorityUrl = tl.getEndpointDataParameter(connectedService, "activeDirectoryAuthority", true) ?? "https://login.microsoftonline.com/";

    tl.debug(`Fetching federated token for service connection ${connectedService}`);
    const federatedToken = await getFederatedToken(connectedService);
    if (!federatedToken) {
        throw new Error("Failed to obtain federated token.");
    }
    tl.debug(`Federated token obtained for service connection ${connectedService}`);

    // Instead of getting an access token string, return a ClientSecretCredential
    return new ClientSecretCredential(
        servicePrincipalTenantId,
        servicePrincipalId,
        federatedToken
    );
}

async function getAccessTokenFromFederatedToken(
    servicePrincipalId: string,
    servicePrincipalTenantId: string,
    federatedToken: string,
    authorityUrl: string
): Promise<string> {
    const AzureDevOpsResourceId = "499b84ac-1321-427f-aa17-267ca6975798";
    const formattedAuthorityUrl = authorityUrl.replace(/\/+$/, ""); // Remove trailing slashes

    tl.debug(`Using authority URL: ${formattedAuthorityUrl}`);
    tl.debug(`Resource ID: ${AzureDevOpsResourceId}`);

    const config: msal.Configuration = {
        auth: {
            clientId: servicePrincipalId,
            authority: `${formattedAuthorityUrl}/${servicePrincipalTenantId}`,
            clientAssertion: federatedToken,
        },
        system: {
            loggerOptions: {
                loggerCallback: (level, message, containsPii) => {
                    tl.debug(message);
                },
                piiLoggingEnabled: false,
                logLevel: msal.LogLevel.Verbose,
            },
        },
    };

    const app = new msal.ConfidentialClientApplication(config);

    const request: msal.ClientCredentialRequest = {
        scopes: [`${AzureDevOpsResourceId}/.default`],
        skipCache: true,
    };

    try {
        const result = await app.acquireTokenByClientCredential(request);
        if (!result || !result.accessToken) {
            throw new Error("Failed to acquire access token.");
        }
        tl.debug(`Access token acquired for service principal ${servicePrincipalId}`);
        return result.accessToken;
    } catch (error) {
        tl.error(`Error acquiring access token: ${error.message}`);
        throw error;
    }
}
