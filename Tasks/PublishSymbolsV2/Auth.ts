import * as tl from "azure-pipelines-task-lib/task";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";

const nodeVersion = parseInt(process.version.split('.')[0].replace('v', ''));
if(nodeVersion < 16) {
    tl.error(tl.loc('NodeVersionSupport', nodeVersion));
}

import * as msal from "@azure/msal-node";
import { getFederatedToken } from "azure-pipelines-tasks-azure-arm-rest/azCliUtility";

export async function getAccessTokenViaWorkloadIdentityFederation(connectedService: string): Promise<string> {

  // workloadidentityfederation
  const authorizationScheme = tl
    .getEndpointAuthorizationSchemeRequired(connectedService)
    .toLowerCase();

  // get token using workload identity federation or managed service identity
  if (authorizationScheme !== "workloadidentityfederation") {
    throw new Error(`Authorization scheme ${authorizationScheme} is not supported.`);
  }

  // use azure devops webapi to get federated token using service connection
  var servicePrincipalId: string =
    tl.getEndpointAuthorizationParameterRequired(connectedService, "serviceprincipalid");

  var servicePrincipalTenantId: string =
    tl.getEndpointAuthorizationParameterRequired(connectedService, "tenantid");

  const authorityUrl =
    tl.getEndpointDataParameter(connectedService, "activeDirectoryAuthority", true) ?? "https://login.microsoftonline.com/";

  tl.debug(`Getting federated token for service connection ${connectedService}`);

  var federatedToken: string = await getFederatedToken(connectedService);

  tl.debug(`Got federated token for service connection ${connectedService}`);

  // exchange federated token for service principal token (below)
  return await getAccessTokenFromFederatedToken(servicePrincipalId, servicePrincipalTenantId, federatedToken, authorityUrl);
}

async function getAccessTokenFromFederatedToken(
  servicePrincipalId: string,
  servicePrincipalTenantId: string,
  federatedToken: string,
  authorityUrl: string
): Promise<string> {
  const AzureDevOpsResourceId = "499b84ac-1321-427f-aa17-267ca6975798";

  // use msal to get access token using service principal with federated token
  tl.debug(`Using authority url: ${authorityUrl}`);
  tl.debug(`Using resource: ${AzureDevOpsResourceId}`);

  const config: msal.Configuration = {
    auth: {
      clientId: servicePrincipalId,
      authority: `${authorityUrl.replace(/\/+$/, "")}/${servicePrincipalTenantId}`,
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

  const result = await app.acquireTokenByClientCredential(request);

  tl.debug(`Got access token for service principal ${servicePrincipalId}`);

  return result?.accessToken;
}