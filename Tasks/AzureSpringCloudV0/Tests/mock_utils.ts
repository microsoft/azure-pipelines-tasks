// export var nock = require('nock');

export function setEndpointData() {
    process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"MOCK_SPN_ID\",\"serviceprincipalkey\":\"MOCK_SPN_KEY\",\"tenantid\":\"MOCK_TENANT_ID\"},\"scheme\":\"ServicePrincipal\"}";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "MOCK_SPN_ID";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "MOCK_SPN_KEY";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "MOCK_TENANT_ID";
    process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "MOCK_SUBSCRIPTION_NAME";
    process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "MOCK_SUBSCRIPTION_ID";
    process.env["ENDPOINT_URL_AzureRMSpn"] = "https://management.azure.com/";
    process.env["ENDPOINT_DATA_AzureRMSpn_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
    process.env["ENDPOINT_DATA_AzureRMSpn_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com/";
}

export function setAgentsData() {
    process.env['TASK_TEST_TRACE'] = '1';
    process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
    process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
    process.env["AGENT_NAME"] = "author";
    process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    process.env["BUILD_BUILDID"] = 'Build.BuildId';
}


// export function mockAzureARMPreDeploymentSteps() {
//     nock('https://management.azure.com', {
//         reqheaders: {
//             "authorization": "Bearer DUMMY_ACCESS_TOKEN",
//             "content-type": "application/json; charset=utf-8",
//             "user-agent": "TFS_useragent"
//         }
//     }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resources?$filter=resourceType%20EQ%20%27Microsoft.AppPlatform%2FSpring%27%20AND%20name%20EQ%20%27MOCK_AZURE_SPRING_CLOUD%27&api-version=2019-05-01-preview")
//     .reply(200, {
//         value: [{ 
//             id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.web/sites/mytestapp", 
//             name: "MOCK_APP_INSIGHTS_NAME",
//             type: "microsoft.insights/components",
//             tags: {}, 
//             properties: {}
//         }]
//      }).persist();
// }