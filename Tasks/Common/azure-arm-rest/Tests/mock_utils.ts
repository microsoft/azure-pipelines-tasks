import { AzureEndpoint, WebTest } from '../azureModels';
import { ApplicationInsightsWebTests } from '../azure-arm-appinsights-webtests';
import * as querystring from "querystring";
import { ApplicationTokenCredentials } from '../azure-arm-common';
export var nock = require('nock');

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
        access_token: "MOCK_ACCESS_TOKEN"
    }).persist(); 

    return endpoint;
}

export function mockAzureARMAppInsightsWebTests() {
    var MockWebTest1: WebTest = (new ApplicationInsightsWebTests(getMockEndpoint(), "MOCK_RESOURCE_GROUP_NAME")).configureNewWebTest("MOCK_APP_INSIGHTS_1", "http://MOCK_APP_1.azurewebsites.net", "MOCK_TEST_1");
    MockWebTest1.tags = {"hidden-link:/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_1": "Resource"};
    var MockWebTest2: WebTest = (new ApplicationInsightsWebTests(getMockEndpoint(), "MOCK_RESOURCE_GROUP_NAME")).configureNewWebTest("MOCK_APP_INSIGHTS_2", "http://MOCK_APP_2.azurewebsites.net", "MOCK_TEST_2");
    MockWebTest2.tags = {"hidden-link:/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_1": "Resource"};

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/webtests?api-version=2015-05-01")
    .reply(200, { value: [MockWebTest1, MockWebTest2] }).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/webtests/VSTS_MOCK_TEST?api-version=2015-05-01")
    .reply(200, MockWebTest1).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/webtests/VSTS_MOCK_TEST_FAIL?api-version=2015-05-01")
    .reply(501, 'Failed to add new web test').persist();

}

export function mockAzureApplicationInsightsTests() {
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME?api-version=2015-05-01")
    .reply(200, { 
        id: "subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME", 
        name: "MOCK_APP_INSIGHTS_NAME",
        type: "microsoft.insights/components",
        tags: {},
        properties: {}
     }).persist();

     nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/FAIL_MOCK_APP_INSIGHTS_NAME?api-version=2015-05-01")
    .reply(500, 'Internal Server error occured.').persist();


    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME?api-version=2015-05-01")
    .reply(200, { 
        id: "subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/MOCK_APP_INSIGHTS_NAME", 
        name: "MOCK_APP_INSIGHTS_NAME",
        type: "microsoft.insights/components",
        tags: {},
        properties: {}
     }).persist();

     nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.insights/components/FAIL_MOCK_APP_INSIGHTS_NAME?api-version=2015-05-01")
    .reply(500, 'Internal Server error occured.').persist();
}

export function mockAzureAppServiceTests() {
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/start?api-version=2016-08-01")
    .reply(200, {}).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/start?api-version=2016-08-01")
    .reply(500,'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/stop?api-version=2016-08-01")
    .reply(200, {}).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/stop?api-version=2016-08-01")
    .reply(500,'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/restart?api-version=2016-08-01")
    .reply(200, {}).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/restart?api-version=2016-08-01")
    .reply(500,'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slotsswap?api-version=2016-08-01", JSON.stringify({
        targetSlot: "MOCK_TARGET_SLOT",
        preserveVnet: false
    }))
    .reply(200, {}).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/slotsswap?api-version=2016-08-01", JSON.stringify({
        targetSlot: "MOCK_TARGET_SLOT",
        preserveVnet: true
    }))
    .reply(409,'one of the slots is in stopped state.').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            state: "Running"
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME?api-version=2016-08-01")
    .reply(500, 'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/?api-version=2016-08-01")
    .once()
    .reply(200, {
        id: "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            state: "Stopped"
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/?api-version=2016-08-01")
    .once()
    .reply(200, {
        id: "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            state: "Running"
        }
    }).persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/publishxml?api-version=2016-08-01")
    .reply(200,`<publishData>
    <publishProfile profileName="MOCK_APP_SERVICE_NAME - Web Deploy" publishMethod="MSDeploy" 
        publishUrl="MOCK_APP_SERVICE_NAME.scm.azurewebsites.net:443" msdeploySite="MOCK_APP_SERVICE_NAME" 
        userName="$MOCK_APP_SERVICE_NAME" userPWD="MOCK_APP_SERVICE_MSDEPLOY_PASSWORD" destinationAppUrl="http://MOCK_APP_SERVICE_NAME.azurewebsites.net">
    </publishProfile>
    </publishData>`).persist();
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/publishxml?api-version=2016-08-01")
    .reply(500, 'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/publishingcredentials/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/publishingcredentials/$MOCK_APP_SERVICE_NAME",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            publishingUserName: "$MOCK_APP_SERVICE_NAME",
            publishingPassword: "MOCK_APP_SERVICE_MSDEPLOY_PASSWORD",
            scmUri: "https://$v:MOCK_APP_SERVICE_MSDEPLOY_PASSWORD@MOCK_APP_SERVICE_NAME.scm.azurewebsites.net"
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/config/publishingcredentials/list?api-version=2016-08-01")
    .reply(500, 'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1"
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/config/appsettings/list?api-version=2016-08-01")
    .reply(500, 'internal_server_error').persist();

    var appSettings = {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/appsettings",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "0"
        }
    };

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/appsettings?api-version=2016-08-01", JSON.stringify(appSettings))
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/appsettings",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "0"
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/config/appsettings?api-version=2016-08-01", JSON.stringify(appSettings))
    .reply(500, 'internal_server_error').persist();

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "alwaysOn": false
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/config/web?api-version=2016-08-01")
    .reply(500, 'internal_server_error').persist();

    var appSettings1 = {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "alwaysOn": true
        }
    };

    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web?api-version=2016-08-01", JSON.stringify(appSettings1))
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web",
        name: "MOCK_APP_SERVICE_NAME",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "alwaysOn": true
        }
    }).persist();;
    
    nock('https://management.azure.com', {
        "authorization": "Bearer DUMMY_ACCESS_TOKEN",
        "content-type": "application/json; charset=utf-8"
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/config/web?api-version=2016-08-01", JSON.stringify(appSettings1))
    .reply(500, 'internal_server_error').persist();
}

export function mockKuduServiceTests() {
    nock('http://MOCK_SCM_WEBSITE').
    put('/api/deployments/MOCK_DEPLOYMENT_ID').reply(200, {
        type: 'Deployment',
        url: 'http://MOCK_SCM_WEBSITE/api/deployments/MOCK_DEPLOYMENT_ID'
    });

    nock('http://FAIL_MOCK_SCM_WEBSITE').
    put('/api/deployments/MOCK_DEPLOYMENT_ID').reply(504,'Some server side issue').persist();

    nock('http://MOCK_SCM_WEBSITE').
    get('/api/continuouswebjobs').reply(200, [
        {name: "CONT_1", status: "Running", runCommand: "hello.cmd", type: "continuous"},
        {name: "CONT_2", status: "Stopped", runCommand: "world.cmd", type: "continuous"},
    ]);

    nock('http://FAIL_MOCK_SCM_WEBSITE').
    get('/api/continuouswebjobs').reply(501, 'Internal error occured');

    nock('http://MOCK_SCM_WEBSITE').
    post('/api/continuouswebjobs/MOCK_JOB_NAME/start')
    .reply(200, {name: "CONT_2", status: "Running", runCommand: "hello.cmd", type: "continuous"});
    
    
    nock('http://FAIL_MOCK_SCM_WEBSITE').
    post('/api/continuouswebjobs/MOCK_JOB_NAME/start').reply(501, 'Internal error occured');

    nock('http://MOCK_SCM_WEBSITE').
    post('/api/continuouswebjobs/MOCK_JOB_NAME/stop')
    .reply(200, {name: "CONT_1", status: "Stopped", runCommand: "hello.cmd", type: "continuous"});
    
    
    nock('http://FAIL_MOCK_SCM_WEBSITE').
    post('/api/continuouswebjobs/MOCK_JOB_NAME/stop').reply(501, 'Internal error occured');

    nock('http://MOCK_SCM_WEBSITE').
    put('/api/siteextensions/MOCK_EXTENSION').
    reply(200, {id: "MOCK_EXT", title: "MOCK_EXT", local_path: "D:\\home\\Mock_Path"});

    nock('http://FAIL_MOCK_SCM_WEBSITE').
    put('/api/siteextensions/MOCK_EXTENSION').reply(501, 'Internal error occured');

    nock('http://MOCK_SCM_WEBSITE').
    get('/api/siteextensions').reply(200, [
        {id: "MOCK_EXT", title: "MOCK_EXT", local_path: "D:\\home\\Mock_Path"},
        {id: "MOCK_EXT_1", title: "MOCK_EXT", local_path: "D:\\home\\Mock_Path"}
    ]);

    nock('http://FAIL_MOCK_SCM_WEBSITE').
    get('/api/siteextensions').reply(501, 'Internal error occured');

    nock('http://MOCK_SCM_WEBSITE').
    get('/api/processes/0').reply(200, { id: 1 });

    nock('http://FAIL_MOCK_SCM_WEBSITE').
    get('/api/processes/0').reply(501, 'Internal error occured');

    nock('http://MOCK_SCM_WEBSITE')
    .delete('/api/processes/0').reply(502, 'Bad Gaterway');

}