import * as path from "path";
import * as mocks from "./L0Mocks";
import { TaskMockRunner } from "vsts-task-lib/mock-run";
var nock = require("nock");

let tmr: TaskMockRunner = new TaskMockRunner(path.join(__dirname, '..', 'azuremonitoralerts.js'));

tmr.setInput("ConnectedServiceName", "azureRMSpn");
tmr.setInput("ResourceGroupName", "testRg");
tmr.setInput("ResourceType", "testResource.provider/type");
tmr.setInput("ResourceName", "testResourceName");
tmr.setInput("AlertRules", JSON.stringify(mocks.mockAlertRules));

nock("http://example.com", {
		reqheaders: {
        	'authorization': 'Bearer accessToken',
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.get(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule1/)
	.query({"api-version": "2016-03-01"})
	.reply(404);

nock("http://example.com", {
		reqheaders: {
        	"authorization": "Bearer accessToken",
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.get("/subscriptions/sId/resourceGroups/testRg/resources")
	.query({
		"$filter": "resourceType EQ 'testResource.provider/type' AND name EQ 'testResourceName'" ,
		"api-version": "2017-05-10"
	})
	.reply(504)
	.persist();

tmr.registerMock("./authorizationclient", mocks);
tmr.run();
