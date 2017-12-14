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
        .reply(200, {});

        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/start?api-version=2016-08-01")
        .reply(500,'internal_server_error');
    }

    public static async start() {
        AzureAppServiceTests.mockStart();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        await appSerivce.start();
    }

    public static async startFailed() {
        AzureAppServiceTests.mockStart();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        await appSerivce.start();
    }

    public static mockStop() {
        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/stop?api-version=2016-08-01")
        .reply(200, {});

        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/stop?api-version=2016-08-01")
        .reply(500,'internal_server_error');
    }

    public static async stop() {
        AzureAppServiceTests.mockStop();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        await appSerivce.stop();
    }

    public static async stopFailed() {
        AzureAppServiceTests.mockStop();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        await appSerivce.stop();
    }

    public static mockRestart() {
        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/restart?api-version=2016-08-01")
        .reply(200, {});

        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/restart?api-version=2016-08-01")
        .reply(500,'internal_server_error');
    }

    public static async restart() {
        AzureAppServiceTests.mockRestart();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        await appSerivce.restart();
    }

    public static async restartFailed() {
        AzureAppServiceTests.mockRestart();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        await appSerivce.restart();
    }

    public static mockSwap() {
        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slotsswap?api-version=2016-08-01", querystring.stringify({
            targetSlot: "MOCK_TARGET_SLOT",
            preserveVnet: false
        }))
        .reply(200, {});

        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/slotsswap?api-version=2016-08-01", querystring.stringify({
            targetSlot: "MOCK_TARGET_SLOT",
            preserveVnet: true
        }))
        .reply(409,'one of the slots is in stopped state');
    }

    public static async swap() {
        AzureAppServiceTests.swap();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        await appSerivce.swap("MOCK_TARGET_SLOT", false);
    }

    public static async swapFailed() {
        AzureAppServiceTests.swap();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        await appSerivce.swap("MOCK_TARGET_SLOT", true);
    }

    public static async mockGet() {
        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/?api-version=2016-08-01", querystring.stringify({
            targetSlot: "MOCK_TARGET_SLOT",
            preserveVnet: false
        }))
        .reply(200, {
            id: "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME",
            name: "MOCK_APP_SERVICE_NAME",
            type: "Microsoft.Web/sites",
            kind: "app",
            location: "South Central US",
            properties: {
                state: "Running"
            }
        });

        nock('https://management.azure.com', {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8"
        }).get("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/?api-version=2016-08-01", querystring.stringify({
            targetSlot: "MOCK_TARGET_SLOT",
            preserveVnet: false
        }))
        .reply(500, 'internal_server_error');
    }

    public static async get() {
        AzureAppServiceTests.mockGet();
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        return await appSerivce.get();
    }
}

AzureAppServiceTests.start().then((values) => {
    console.log(values);
}, (error) => {
    tl.setResult(tl.TaskResult.Failed, error);
});

AzureAppServiceTests.stop().then((values) => {
    console.log(values);
}, (error) => {
    tl.setResult(tl.TaskResult.Failed, error);
});

AzureAppServiceTests.restart().then((values) => {
    console.log(values);
}, (error) => {
    tl.setResult(tl.TaskResult.Failed, error);
});

AzureAppServiceTests.swap().then((values) => {
    console.log(values);
}, (error) => {
    tl.setResult(tl.TaskResult.Failed, error);
});

AzureAppServiceTests.get().then((value) => {
        console.log(value.id);
}).catch((error) => {
    tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should pass ' + error);
})

Promise.all([
    AzureAppServiceTests.get()
]).then((values) => {
    for(var value of values) {
        console.log(value.id);
    }
}, (error) => {
    tl.setResult(tl.TaskResult.Failed, error);
});

AzureAppServiceTests.startFailed().then(() => {
    tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.startFailed() should fail');
}, (error) => {
    console.log(error);
});

AzureAppServiceTests.stopFailed().then(() => {
    tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stopFailed() should fail');
}, (error) => {
    console.log(error);
});

AzureAppServiceTests.restartFailed().then(() => {
    tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.restartFailed() should fail');
}, (error) => {
    console.log(error);
});

// AzureAppServiceTests.swapFailed().then(() => {
//     tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.swapFailed() should fail');
// }, (error) => {
//     console.log(error);
// });

