import { AzureAppService } from '../azure-arm-app-service';
import { getMockEndpoint, nock } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('vsts-task-lib');
var endpoint = getMockEndpoint();

class AzureAppServiceTests {
    public static mockStart() {
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
    }

    public static async start() {
        AzureAppServiceTests.mockStart();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            await appSerivce.start();
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.start() should have passed but failed');
        }

        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.start();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.start() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static mockStop() {
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
    }

    public static async stop() {
        AzureAppServiceTests.mockStop();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        appSerivce.stop().catch((error) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stop() should have passed but failed');
        });

        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.stop().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stop() should have failed but passed');
        });

        
    }

    public static mockRestart() {
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
    }

    public static async restart() {
        AzureAppServiceTests.mockRestart();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        appSerivce.restart().catch((error) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.restart() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.restart().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.restart() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static mockSwap() {
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
        .reply(409,'one of the slots is in stopped state.').persist();;
    }

    public static async swap() {
        AzureAppServiceTests.mockSwap();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        appSerivce.swap("MOCK_TARGET_SLOT", false).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.swap() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.swap("MOCK_TARGET_SLOT", true).then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.swap() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
        
    }

    public static async mockGet() {
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
        .reply(500, 'internal_server_error').persist();;
    }

    public static async get() {
        AzureAppServiceTests.mockGet();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.get().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.get().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
        
    }

    public static async mockMonitorAppState() {
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
        }).persist();;
        
    }

    public static async monitorAppState() {
        AzureAppServiceTests.mockMonitorAppState();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.monitorAppState("Running")
        .catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.monitorAppState() should have passed but failed');
        });
    }

    public static async mockGetPublishingProfileWithSecrets() {
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
    }

    public static async getPublishingProfileWithSecrets() {
        AzureAppServiceTests.mockGetPublishingProfileWithSecrets();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getPublishingProfileWithSecrets().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME PUBLISHING_PROFILE : ' + value);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingProfileWithSecrets() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getPublishingProfileWithSecrets().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingProfileWithSecrets() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });        
    }

    public static async getWebDeployPublishingProfile() {
        AzureAppServiceTests.mockGetPublishingProfileWithSecrets();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getWebDeployPublishingProfile().then((value) => {
            console.log('WEB DEPLOY PUBLISHING PROFILE: ' + value.profileName);
        }).catch((error) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getWebDeployPublishingProfile() should have passed but failed');
            console.log(error);
        });        
    }

    public static async mockGetPublishingCredentials() {
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
    }

    public static async getPublishingCredentials() {
        AzureAppServiceTests.mockGetPublishingCredentials();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getPublishingCredentials().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingCredentials() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getPublishingCredentials().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingCredentials() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async mockGetApplicationSettings() {
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
    }

    public static async getApplicationSettings() {
        AzureAppServiceTests.mockGetApplicationSettings();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getApplicationSettings().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME APPSETTINGS ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getApplicationSettings() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getApplicationSettings().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getApplicationSettings() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async mockUpdateApplicationSettings() {

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
    }

    public static async updateApplicationSettings() {
        AzureAppServiceTests.mockUpdateApplicationSettings();
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

        AzureAppServiceTests.mockGetPublishingCredentials();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.updateApplicationSettings(appSettings).then((value) => {
            console.log('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateApplicationSettings() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.updateApplicationSettings(appSettings).then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateApplicationSettings() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }
    
    public static async mockGetConfiguration() {
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
    }

    public static async getConfiguration() {
        AzureAppServiceTests.mockGetConfiguration();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getConfiguration().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getConfiguration() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getApplicationSettings().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getConfiguration() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async mockUpdateConfiguration() {

        var appSettings = {
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
        }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web?api-version=2016-08-01", JSON.stringify(appSettings))
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
        }).put("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/config/web?api-version=2016-08-01", JSON.stringify(appSettings))
        .reply(500, 'internal_server_error').persist();
    }

    public static async updateConfiguration() {
        AzureAppServiceTests.mockUpdateConfiguration();
        var appSettings = {
            id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web",
            name: "MOCK_APP_SERVICE_NAME",
            type: "Microsoft.Web/sites",
            kind: "app",
            location: "South Central US",
            properties: {
                "alwaysOn": true
            }
        };

        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.updateConfiguration(appSettings).then((value) => {
            console.log('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.updateConfiguration(appSettings).then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async getKuduService() {
        AzureAppServiceTests.mockGetPublishingCredentials();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getKuduService().then((value) => {
            console.log('KUDU SERVICE FROM APP SERVICE');
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have passed but failed');
        });
    }
}

AzureAppServiceTests.start();
AzureAppServiceTests.stop();
AzureAppServiceTests.restart();
AzureAppServiceTests.swap();
AzureAppServiceTests.get();
AzureAppServiceTests.monitorAppState();
AzureAppServiceTests.getPublishingProfileWithSecrets();
AzureAppServiceTests.getWebDeployPublishingProfile();
AzureAppServiceTests.getPublishingCredentials();
AzureAppServiceTests.getApplicationSettings();
AzureAppServiceTests.updateApplicationSettings();
AzureAppServiceTests.getConfiguration();
AzureAppServiceTests.updateConfiguration();
AzureAppServiceTests.getKuduService();
