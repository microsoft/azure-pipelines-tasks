export var nock = require('nock');

export function mockAzureARMPreDeploymentSteps() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resources?$filter=resourceType%20EQ%20%27Microsoft.AppPlatform%2FSpring%27%20AND%20name%20EQ%20%27MOCK_AZURE_SPRING_CLOUD%27&api-version=2019-05-01-preview")
    .reply(200, {
        value: [{ 
            id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.web/sites/mytestapp", 
            name: "MOCK_APP_INSIGHTS_NAME",
            type: "microsoft.insights/components",
            tags: {}, 
            properties: {}
        }]
     }).persist();
}