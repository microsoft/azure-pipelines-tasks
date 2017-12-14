import { AzureAppService } from '../azure-arm-app-service';
import { getMockEndpoint, nock } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('vsts-task-lib');
var endpoint = getMockEndpoint();


nock('https://management.azure.com', {
    "authorization": "Bearer DUMMY_ACCESS_TOKEN",
    "content-type": "application/json; charset=utf-8"
}).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slotsswap?api-version=2016-08-01", JSON.stringify({
    targetSlot: "MOCK_TARGET_SLOT",
    preserveVnet: false
}))
.reply(200, {});

nock('https://management.azure.com', {
    "authorization": "Bearer DUMMY_ACCESS_TOKEN",
    "content-type": "application/json; charset=utf-8"
}).post("/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/slots/MOCK_SLOT_NAME/slotsswap?api-version=2016-08-01", JSON.stringify({
    targetSlot: "MOCK_TARGET_SLOT",
    preserveVnet: true
})).
reply(409,'one of the slots is in stopped state.');


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

