import  * as ma from 'vsts-task-lib/mock-answer';
import * as tmrm from 'vsts-task-lib/mock-run';
import * as path from 'path';

let taskPath = path.join(__dirname, '..', 'nlbtask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('ConnectedServiceName', 'AzureRMSpn');
tmr.setInput("ResourceGroupName", "testRG");
tmr.setInput("LoadBalancer", "testLB");
tmr.setInput("Action", "Disconnect");

process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
process.env["COMPUTERNAME"] = "test-vm";

var tl = require('vsts-task-lib/mock-task');
tmr.registerMock('./nlbazureutility', {
	getNetworkInterfacesInRG: function(SPN, endpointUrl, resourceGroupName) {
		throw tl.loc("CouldNotFetchNetworkInterfacesInRg");					
	}
});

tmr.run();
