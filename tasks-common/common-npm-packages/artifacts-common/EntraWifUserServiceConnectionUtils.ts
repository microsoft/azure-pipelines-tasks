import path = require("path");
import * as tl from 'azure-pipelines-task-lib/task';
import { getSystemAccessToken } from "./webapi";
import fetch from "node-fetch";
import { retryOnException } from "./retryUtils";

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

const ADO_RESOURCE : string = "499b84ac-1321-427f-aa17-267ca6975798/.default";
const CLIENT_ASSERTION_TYPE : string = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const GRANT_TYPE = "client_credentials";
const PPE_HOSTS : string [] = ["vsts.me","codedev.ms","devppe.azure.com"];

export async function getFederatedWorkloadIdentityCredentials(serviceConnectionName: string, tenantId?: string) : Promise<string | undefined>{
    let tenant = tenantId ?? tl.getEndpointAuthorizationParameterRequired(serviceConnectionName, "TenantId");
    tl.debug(tl.loc('Info_UsingTenantId', tenantId));
    const systemAccessToken = getSystemAccessToken();
    const url = process.env["SYSTEM_OIDCREQUESTURI"]+"?api-version=7.1&serviceConnectionId="+serviceConnectionName;
    
    return await retryOnException(async () => {
        var oidcToken = await fetch(url, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+ systemAccessToken
            }
        }).then(async response => {
            var oidcObject = await (response?.json()) as {oidcToken: string};

            if (!oidcObject?.oidcToken){
                throw new Error(tl.loc("Error_FederatedTokenAquisitionFailed"));
            }
            return oidcObject.oidcToken;
        });
        
        tl.setSecret(oidcToken);
        let entraURI = getEntraLoginUrl() + tenant + "/oauth2/v2.0/token";
        let clientId = tl.getEndpointAuthorizationParameterRequired(serviceConnectionName, "ServicePrincipalId");

        let body = {
            'scope': ADO_RESOURCE,
            'client_id': clientId,
            'client_assertion_type': CLIENT_ASSERTION_TYPE,
            'client_assertion': oidcToken,
            'grant_type': GRANT_TYPE
        };

        let formBody = Object.keys(body)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(body[key]))
        .join('&');

        return await fetch(entraURI, {
            method: 'POST', 
            body: formBody,
            headers: 
            {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(async response => {
            var tokenObject = await (response?.json()) as {access_token: string};
    
            if (!tokenObject?.access_token){
                throw new Error(tl.loc("Error_FederatedTokenAquisitionFailed"));
            }
            
            tl.setSecret(tokenObject.access_token);
            return tokenObject.access_token;
        });
    }, 3, 1000);
}

export async function getFeedTenantId(feedUrl: string) : Promise<string | undefined>{
    try {
        const feedResponse =  await fetch(feedUrl);
        return feedResponse?.headers?.get('X-VSS-ResourceTenant');
    } 
    catch (error){
        tl.warning(tl.loc("Error_GetFeedTenantIdFailed", error));
        return undefined;
    }
}

function getEntraLoginUrl() : string {
    var url = process.env["SYSTEM_COLLECTIONURI"];
    let isPPE = false;
    PPE_HOSTS.forEach(ppe_host => {
        if(url.includes(ppe_host)){
            isPPE = true;
        };
    });

    if(isPPE){
        return "https://login.windows-ppe.net/";
    }

    return "https://login.windows.net/";
}