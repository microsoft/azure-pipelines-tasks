var nock = require('nock');
import * as querystring from "querystring";

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

export function initializeAzureEndpointMock() {
    nock("https://login.windows.net", {
        reqheaders: {
            "content-type": "application/x-www-form-urlencoded; charset=utf-8",
            "user-agent": "TEST_AGENT"
          }
    })
    .post("/tenant/oauth2/token/", querystring.stringify({
        resource: "https://management.azure.com/",
        client_id: "id",
        grant_type: "client_credentials",
        client_secret: "key"
    }))
    .reply(200, { 
        access_token: "DUMMY_ACCESS_TOKEN"
    }).persist();    
}

export function initializeAzureResourceMock() {
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    })
    .get(encodeURI("/subscriptions/sId/resources?$filter=resourceType EQ 'Microsoft.Web/Sites' AND name EQ 'APP_SERVICE_NAME'&api-version=2016-07-01").replace(/'/g, "%27"))
    .reply(200, {
        value: [
            {
                "id": "/subscriptions/sId/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/APP_SERVICE_NAME",
                "name": "",
                "type": "Microsoft.Web/sites",
                "kind": "app",
                "location": "eastus"
            }
        ]
    });
}

export function initializeGetAppServiceDetailsMock(state: string) {
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    })
    .get("/subscriptions/sId/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/APP_SERVICE_NAME/?api-version=2016-08-01")
    .reply(200,
        {
            "id": "/subscriptions/sId/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/APP_SERVICE_NAME",
            "name": "",
            "type": "Microsoft.Web/sites",
            "kind": "app",
            "location": "South Central US",
            "properties": {
                "state": state
        }
    });
}

export function initializePublishProfile() {
    var mockedProfile = `<publishData> 
        <publishProfile profileName="MOCK_MSDEPLOY_PROFILE" publishMethod="MSDeploy" publishUrl="APP_SERVICE_NAME.scm.azurewebsites.net:443" msdeploySite="APP_SERVICE_NAME" userName="$APP_SERVICE_NAME" userPWD="MOCK_MSDEPLOY_PASSWORD" destinationAppUrl="http://APP_SERVICE_NAME.azurewebsites.net">
            <databases />
        </publishProfile>
    </publishData>`;

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    })
    .post("/subscriptions/sId/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/APP_SERVICE_NAME/publishxml?api-version=2016-08-01")
    .reply(200, mockedProfile);

}
