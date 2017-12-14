import { AzureEndpoint } from '../azureModels';
import * as querystring from "querystring";
export var nock = require('nock');
/*
export function mockEndpointTaskLibData() {
    process.env["ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "id";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "key";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "tenant";
    process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
    process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
    process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
    process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
    process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENT"] = "AzureCloud";
    process.env["ENDPOINT_URL_PatEndpoint"] = "https://testking123.visualstudio.com";
    process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com";
    process.env["AZURE_HTTP_USER_AGENT"] = "TEST_AGENT";
}
*/

export function getMockEndpoint() {
    process.env["AZURE_HTTP_USER_AGENT"] = "TEST_AGENT";
    var endpoint: AzureEndpoint = {
        activeDirectoryAuthority: "https://login.windows.net/",
        environment: "AzureCloud",
        servicePrincipalClientID: "MOCK_SPN_ID",
        servicePrincipalKey: "MOCK_SPN_KEY",
        subscriptionID: "MOCK_SUBSCRIPTION_ID",
        subscriptionName: "MOCK_SUBSCRIPTION_NAME",
        tenantID: "MOCK_TENANT_ID",
        url: "https://management.azure.com/",
        environmentAuthorityUrl: "https://login.windows.net/",
        activeDirectoryResourceID: "https://management.azure.com/"
    }
    
    nock("https://login.windows.net", {
        reqheaders: {
            "content-type": "application/x-www-form-urlencoded; charset=utf-8"
          }
    })
    .post("/MOCK_TENANT_ID/oauth2/token/", querystring.stringify({
        resource: "https://management.azure.com/",
        client_id: "MOCK_SPN_ID",
        grant_type: "client_credentials",
        client_secret: "MOCK_SPN_KEY"
    }))
    .reply(200, { 
        access_token: "MOCK_ACCESS_TOKEN"
    }).persist(); 

    return endpoint;
}

