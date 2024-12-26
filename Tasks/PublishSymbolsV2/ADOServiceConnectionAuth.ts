import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry'

export async function getAccessTokenViaWIFederationUsingADOServiceConnection(connectedService: string): Promise<string> {

  let forceReinstallCredentialProvider = null;
  try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    const ADOResponse: { oidcToken: String } = await (await fetch(process.env["SYSTEM_OIDCREQUESTURI"] + "?api-version=7.1&serviceConnectionId=" + connectedService, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env["SYSTEM_ACCESSTOKEN"]
      }
    })).json() as { oidcToken: String };

    let tenant = tl.getEndpointAuthorizationParameterRequired(connectedService, "TenantId");
    let entraURI = "https://login.microsoftonline.com/" + tenant + "/oauth2/v2.0/token"; // let entraURI = "https://login.windows-ppe.net/"+tenant+"/oauth2/v2.0/token";

    let clientId = tl.getEndpointAuthorizationParameterRequired(connectedService, "ServicePrincipalId");

    let body = {
      'scope': "499b84ac-1321-427f-aa17-267ca6975798/.default",
      'client_id': clientId,
      'client_assertion_type': "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      'client_assertion': ADOResponse.oidcToken,
      'grant_type': "client_credentials"
    };
    let formBody = Object.keys(body)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(body[key]))
      .join('&');

    const entraResponse: { access_token: string } = await (await fetch(entraURI, {
      method: 'POST',
      body: formBody,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })).json() as { access_token: string };

    return await entraResponse.access_token;

  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);

  } finally {

    emitTelemetry("ArtifactCore", "PublishSymbolsV2", {
      'PublishSymbolsV2.ForceReinstallCredentialProvider': forceReinstallCredentialProvider
    });
  }
}