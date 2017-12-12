import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import MockUtil = require('./MockUtility');
var nock = require('nock');
let taskPath = path.join(__dirname, '..', 'azureappservicemanage.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
import * as querystring from "querystring";

tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('Action', 'Start Azure App Service');
tr.setInput('WebAppName', 'APP_SERVICE_NAME');

let mockTaskLibAnswers: ma.TaskLibAnswers = <ma.TaskLibAnswers> { }

MockUtil.initializeAzureEndpointMock();
MockUtil.initializeAzureResourceMock();
MockUtil.initializeGetAppServiceDetailsMock("Running");
MockUtil.initializePublishProfile();

nock('https://management.azure.com', {
    "authorization": "Bearer DUMMY_ACCESS_TOKEN",
    "content-type": "application/json; charset=utf-8"
}).post("/subscriptions/sId/resourceGroups/MOCK_RESOURCE_GROUP_NAME/providers/Microsoft.Web/sites/APP_SERVICE_NAME/start?api-version=2016-08-01")
.reply(200, {});

nock('http://APP_SERVICE_NAME.azurewebsites.net').get('/').reply(200, 'APP_CONTENT').persist();

tr.setAnswers(mockTaskLibAnswers);
tr.run();