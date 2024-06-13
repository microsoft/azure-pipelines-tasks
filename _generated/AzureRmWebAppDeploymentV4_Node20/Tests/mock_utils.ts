export var nock = require('nock');

export function mockAzureARMPreDeploymentSteps() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resources?$filter=resourceType%20EQ%20%27Microsoft.Web%2FSites%27%20AND%20name%20EQ%20%27mytestapp%27&api-version=2016-07-01")
    .reply(200, {
        value: [{ 
            id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/microsoft.web/sites/mytestapp", 
            name: "MOCK_APP_INSIGHTS_NAME",
            type: "microsoft.insights/components",
            tags: {},
            properties: {}
        }]
     }).persist();

     nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/publishingcredentials/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/mytestapp/publishingcredentials/$mytestapp",
        name: "mytestapp",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            publishingUserName: "$mytestapp",
            publishingPassword: "MOCK_APP_SERVICE_MSDEPLOY_PASSWORD",
            scmUri: "https://$mytestapp:MOCK_APP_SERVICE_MSDEPLOY_PASSWORD@mytestapp.scm.azurewebsites.net"
        }
    }).persist();

    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/publishxml?api-version=2016-08-01")
    .reply(200,`<publishData>
    <publishProfile profileName="mytestapp - Web Deploy" publishMethod="MSDeploy" 
        publishUrl="mytestapp.scm.azurewebsites.net:443" msdeploySite="mytestapp" 
        userName="$mytestapp" userPWD="MOCK_APP_SERVICE_MSDEPLOY_PASSWORD" destinationAppUrl="http://mytestapp.azurewebsites.net">
    </publishProfile>
    </publishData>`).persist();

    nock('https://$mytestapp:MOCK_APP_SERVICE_MSDEPLOY_PASSWORD@mytestapp.scm.azurewebsites.net',
    {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).
    put('/api/deployments/MOCK_DEPLOYMENT_ID').reply(200, {
        type: 'Deployment',
        url: 'http://MOCK_SCM_WEBSITE/api/deployments/MOCK_DEPLOYMENT_ID'
    });

    // linux built in app
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/web?api-version=2018-02-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/mytestapp/config/web",
        name: "mytestapp",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "alwaysOn": true,
            "virtualApplications": [ {"physicalPath" : "physicalPath", "virtualPath":  "/virtualApplication" }]
        }
    }).persist();
    
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).patch("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/web?api-version=2018-02-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/mytestapp/config/web",
        name: "mytestapp",
        type: "Microsoft.Web/sites",
        kind: "app",
        location: "South Central US",
        properties: {
            "alwaysOn": true
        }
    }).persist();
}

export function mockLinuxAppSettings() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1",
            "INIT_SCRIPT":"/home/site/wwwroot/startupscript_webAppPkg.sh"
        }
    }).persist();

    var appSettings = {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION":"6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES":"1",
            "INIT_SCRIPT":"/home/site/wwwroot/startupscript_webAppPkg.sh"
        }
    };
    
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings?api-version=2016-08-01", JSON.stringify(appSettings))
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1",
            "INIT_SCRIPT": "/home/site/wwwroot/startupscript_webAppPkg.sh"
        }
    }).persist();
}

export function mockRunFromZipSettings() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1",
            "WEBSITE_RUN_FROM_PACKAGE":"1"
        }
    }).persist();

    var appSettings = {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION":"6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES":"1",
            "WEBSITE_RUN_FROM_PACKAGE":"1"
        }
    };
    
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings?api-version=2016-08-01", JSON.stringify(appSettings))
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1",
            "WEBSITE_RUN_FROM_PACKAGE":"1"
        }
    }).persist();
}

export function mockZipDeploySettings() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1"
        }
    }).persist();

    var appSettings = {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION":"6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES":"1"
        }
    };
    
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings?api-version=2016-08-01", JSON.stringify(appSettings))
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1"
        }
    }).persist();
}

export function mockContainerDeploySettings() {
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings/list?api-version=2016-08-01")
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1",
            "DOCKER_CUSTOM_IMAGE_NAME": "dockernamespace/dockerrepository:DockerImageTag"
        }
    }).persist();

    var appSettings = {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION":"6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES":"1",
            "DOCKER_CUSTOM_IMAGE_NAME": "dockernamespace/dockerrepository:DockerImageTag"
        }
    };
    
    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/config/appsettings?api-version=2016-08-01", JSON.stringify(appSettings))
    .reply(200, {
        id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/mytestapp/appsettings",
        name: "mytestapp",
        type: "Microsoft.Web/sites/config",
        location: "South Central US",
        properties: {
            "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
            "MSDEPLOY_RENAME_LOCKED_FILES": "1",
            "DOCKER_CUSTOM_IMAGE_NAME": "dockernamespace/dockerrepository:DockerImageTag"
        }
    }).persist();
}