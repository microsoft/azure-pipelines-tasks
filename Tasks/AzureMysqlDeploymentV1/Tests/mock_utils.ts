import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import * as querystring from "querystring";
import { ApplicationTokenCredentials } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common';
export var nock = require('nock');
import { FirewallRule, FirewallAddressRange } from '../models/Firewall';

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
        activeDirectoryResourceID: "https://management.azure.com/",
        applicationTokenCredentials: new ApplicationTokenCredentials("MOCK_SPN_ID", "MOCK_TENANT_ID", "MOCK_SPN_KEY", "https://management.azure.com/",
        "https://login.windows.net/", "https://management.azure.com/", false)
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
        access_token: "DUMMY_ACCESS_TOKEN"
    }).persist(); 

    return endpoint;
}

export function getMockMysqlServers() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/providers/Microsoft.DBforMySQL/servers?api-version=2017-12-01")
        .reply(200, {
             value: [{
                "id": "/subscriptions/ffffffff-ffff-ffff-ffff-ffffffffffff/resourceGroups/TestGroup/providers/Microsoft.DBforMySQL/servers/testserver",
                "name": "testserver",
                "properties": {
                  "fullyQualifiedDomainName": "testserver.test-vm1.onebox.xdb.mscds.com"
                }
            },
            {
                "name": "serverWithoutId",
                "properties": {
                    "fullyQualifiedDomainName": "serverWithoutId.test-vm1.onebox.xdb.mscds.com"
                }
            },
            {
                "id": "/subscriptions/ffffffff-ffff-ffff-ffff-ffffffffffff/NotResourceGroup/TestGroup/providers/Microsoft.DBforMySQL/servers/serverWithInvalidId",
                "name": "serverWithInvalidId",
                "properties": {
                    "fullyQualifiedDomainName": "serverWithInvalidId.test-vm1.onebox.xdb.mscds.com"
                }
            }]}).persist();
}


export function getMockFirewallRules(){
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.DBforMySQL/servers/MOCK_SERVER_NAME/firewallRules/IPAddressRange_MOCK_RELEASE_ID12345?api-version=2017-12-01").reply(201, {
        "id": "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.DBforMySQL/servers/MOCK_SERVER_NAME/firewallRules/IPAddressRange_MOCKID",
        "name": "rule1",
        "type": "Microsoft.DBforMySQL/servers/firewallRules",
        "properties": {
          "startIpAddress": "0.0.0.0",
          "endIpAddress": "255.255.255.255"
        }
      }).persist();

    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }
    })
    .delete("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.DBforMySQL/servers/MOCK_SERVER_NAME/firewallRules/IPAddressRange_MOCK_RELEASE_ID12345?api-version=2017-12-01")
    .reply(200).persist();

}
