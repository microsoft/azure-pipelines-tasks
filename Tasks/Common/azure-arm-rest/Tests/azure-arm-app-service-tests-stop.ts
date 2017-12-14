import { AzureAppService } from '../azure-arm-app-service';
import { getMockEndpoint, nock } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('vsts-task-lib');
var endpoint = getMockEndpoint();


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


var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");

appSerivce.stop().catch((error) => {
    tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stop() should have passed but failed');
});

var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
appSerivceSlot.stop().then((value) => {
    tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stop() should have failed but passed');
});
