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
tmr.setInput("NotifyServiceOwners", "true");
tmr.setInput("NotifyEmails", "abc@d.com; ;    ; def@g.com     ;");

nock("http://example.com", {
		reqheaders: {
        	'authorization': 'Bearer accessToken',
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.get(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule1/)
	.query({"api-version": "2016-03-01"})
	.reply(200, {
		location: "alertrulelocation",
		properties: {
			condition: {
				dataSource: {
					"$type": "Microsoft.WindowsAzure.Management.Monitoring.Alerts.Models.RuleMetricDataSource, Microsoft.WindowsAzure.Management.Mon.Client",
            		"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
            		"resourceUri": "/subscriptions/sId/resourceGroups/testRg/providers/testResource.provider/type/testResourceName"
				}
			},
			"actions": [
	        {
	        	"$type": "Microsoft.WindowsAzure.Management.Monitoring.Alerts.Models.RuleWebhookAction, Microsoft.WindowsAzure.Management.Mon.Client",
	        	"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleWebhookAction",
	        	"serviceUri": "http://example.example",
	        	"properties": null
	        }]
	    }
	})

nock("http://example.com", {
		reqheaders: {
        	'authorization': 'Bearer accessToken',
        	"accept": "application/json",
    		"user-agent": "TFS_useragent"
      	}
	})
	.get(/\/subscriptions\/sId\/resourceGroups\/testRg\/providers\/Microsoft.insights\/alertrules\/Rule2/)
	.query({"api-version": "2016-03-01"})
	.reply(200, {
		location: "alertrulelocation",
		properties: {
			condition: {
				dataSource: {
					"$type": "Microsoft.WindowsAzure.Management.Monitoring.Alerts.Models.RuleMetricDataSource, Microsoft.WindowsAzure.Management.Mon.Client",
            		"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
            		"resourceUri": "/subscriptions/sId/resourceGroups/testRg/providers/testResource.provider/type/testResourceName"
				}
			}
		},
		"actions": []
	})

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
requestBody.properties.actions.push({
	"$type": "Microsoft.WindowsAzure.Management.Monitoring.Alerts.Models.RuleWebhookAction, Microsoft.WindowsAzure.Management.Mon.Client",
	"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleWebhookAction",
	"serviceUri": "http://example.example",
	"properties": null
},
{
	"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleEmailAction",
	"sendToServiceOwners": true, 
	"customEmails": ["abc@d.com", "def@g.com"] 
});

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
requestBody.properties.actions.push({
	"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleEmailAction",
	"sendToServiceOwners": true, 
	"customEmails": ["abc@d.com", "def@g.com"] 
});

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
