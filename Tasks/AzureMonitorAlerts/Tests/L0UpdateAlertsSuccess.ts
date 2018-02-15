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
	.get(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/*/)
	.query({"api-version": "2016-03-01"})
	.reply(200, {
		location: "alertrulelocation",
		tags: { tag1: "tag" }
	})
	.persist();

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
	.reply(200, {
		value: [{ 
			id: "id",
			name: "myRule",
			location: "testlocation"
		}]
	})
	.persist();

let requestBody = mocks.getMetricRequestBody("Rule1", "alertrulelocation", "GreaterThan", "metric1", "20", "PT5M");
requestBody.tags["tag1"] = "tag";
nock("http://example.com", {
		reqheaders: {
        	"authorization": "Bearer accessToken",
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.put(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule1/, requestBody)
	.query({
		"api-version": "2016-03-01"
	})
	.reply(200);

requestBody = mocks.getMetricRequestBody("Rule2", "alertrulelocation", "LessThanOrEqual", "metric2", "10", "PT10M");
requestBody.tags["tag1"] = "tag";
nock("http://example.com", {
		reqheaders: {
        	"authorization": "Bearer accessToken",
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.put(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule2/, requestBody)
	.query({
		"api-version": "2016-03-01"
	})
	.reply(200);

tmr.registerMock("./authorizationclient", mocks);
tmr.registerMock("./utility", mocks.getUtilityMock());
tmr.run();
