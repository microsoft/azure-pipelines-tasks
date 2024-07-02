import * as tl from "azure-pipelines-task-lib/task";
import * as clientToolUtils from "azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities";
import * as msal from "@azure/msal-node";

import { getFederatedToken } from "azure-pipelines-tasks-artifacts-common/webapi";

export async function getAccessToken(): Promise<string> {
  try {
    let AsAccountName = tl.getVariable("ArtifactServices.Symbol.AccountName");
    const hasAccountName : boolean = (AsAccountName) ? true : false;
    const connectedServiceName : string = tl.getInput("ConnectedServiceName", !hasAccountName);
    tl.debug(`connectedServiceName: ${connectedServiceName}`);
    const usePat : boolean = tl.getBoolInput("usePat", false);

    if (usePat) {
      if (connectedServiceName)
      {
        throw new Error(`Service connection is not supported when 'usePat' is set to 'false'.`);
      }

      const patVar : string = 'ArtifactServices.Drop.PAT';

      tl.debug(`Retrieving PAT from to pipeline variable '${patVar}'`);
      return tl.getVariable(patVar);
    }

    if (connectedServiceName)
    {
      tl.debug(`Retrieving access token from service connection.`);
      return await getAccessTokenViaWorkloadIdentityFederation(connectedServiceName);
    }

    tl.debug(`Retrieving system access token`);
    return clientToolUtils.getSystemAccessToken();
  } catch (err: any) {
    tl.setResult(tl.TaskResult.Failed, err.message);
    throw err;
  }
}

async function getAccessTokenViaWorkloadIdentityFederation(connectedService: string): Promise<string> {
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