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
	.reply(200, {
		id: "id",
		name: "Rule1",
		location: "alertrulelocation",
		tags: { tag1: "tag" },
		properties: {
			condition: {
				dataSource: {
					"$type": "Microsoft.WindowsAzure.Management.Monitoring.Alerts.Models.RuleMetricDataSource, Microsoft.WindowsAzure.Management.Mon.Client",
            		"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
            		"resourceUri": "/subscriptions/sId/resourceGroups/testRg/providers/testResource.provider/type/testResourceName2"
				}
			}
		}
	})
	.persist();

tmr.registerMock("./authorizationclient", mocks);
tmr.run();
