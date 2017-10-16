import * as querystring from "querystring";
import * as path from "path";
import * as mocks from "./L0Mocks";
import { TaskMockRunner } from "vsts-task-lib/mock-run";
var nock = require("nock");

let tmr: TaskMockRunner = new TaskMockRunner(path.join(__dirname, "..", "azuremonitoralerts.js"));

tmr.setInput("ConnectedServiceName", "azureRMSpn");
tmr.setInput("ResourceGroupName", "testRg");
tmr.setInput("ResourceType", "testResource.provider/type");
tmr.setInput("ResourceName", "testResourceName");
tmr.setInput("AlertRules", JSON.stringify(mocks.mockAlertRules));

nock("https://login.windows.net", {
		reqheaders: {
        	"content-type": "application/x-www-form-urlencoded; charset=utf-8",
    		"user-agent": "TFS_useragent"
      	}
	})
	.post("/tenantId/oauth2/token/", querystring.stringify({
		resource: "http://example.com/",
		client_id: "spId",
		grant_type: "client_credentials",
		client_secret: "spKey"
	}))
	.reply(401)
	.persist();

tmr.run();