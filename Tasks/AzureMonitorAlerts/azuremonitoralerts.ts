import * as tl from "vsts-task-lib/task";
import * as path from "path";

import { initializeAzureRMEndpointData } from "azurestack-common/azurestackrestutility";

import { AzureRmAlertRulesRestClient } from "./azurermalertrulesrestclient";
import { 
	IAzureMetricAlertRulesList,
	IAzureMetricAlertRule 
} from "./interfaces";

async function run() {
	try {
		tl.setResourcePath(path.join(__dirname, "task.json"));

		let connectedServiceName: string = tl.getInput("ConnectedServiceName", true);
		let resourceGroupName: string = tl.getInput("ResourceGroupName", true);
		let resourceType: string = tl.getInput("ResourceType", true);
		let resourceName: string = tl.getInput("ResourceName", true);
		let alertRules: IAzureMetricAlertRulesList = JSON.parse(tl.getInput("AlertRules", true));
		let notifyServiceOwners: boolean = tl.getInput("NotifyServiceOwners") && tl.getInput("NotifyServiceOwners").toLowerCase() === "true" ? true : false;
		let notifyEmails: string = tl.getInput("NotifyEmails");
		let endpoint = await initializeAzureRMEndpointData(connectedServiceName);

		let resourceId: string = `/subscriptions/${endpoint["subscriptionId"]}/resourceGroups/${resourceGroupName}/providers/${resourceType}/${resourceName}`

		await addOrUpdateAlertRules(endpoint, resourceGroupName, resourceId, alertRules.rules, notifyServiceOwners, notifyEmails);
	}
	catch (error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

async function addOrUpdateAlertRules(endpoint, resourceGroupName: string, resourceId: string, alertRules: IAzureMetricAlertRule[], notifyServiceOwners: boolean, notifyEmails: string) {
	
	let azureRmRestClient = new AzureRmAlertRulesRestClient(endpoint);

	for(let rule of alertRules) {
		
		console.log(tl.loc("ProcessingRule", rule.alertName));
		let responseObject = await azureRmRestClient.addOrUpdateAzureMetricAlertRule(resourceGroupName, resourceId, rule, notifyServiceOwners, notifyEmails);
		if (responseObject.statusCode === 201) {
			console.log(tl.loc("CreatedRule", rule.alertName));
		}
		else {
			console.log(tl.loc("UpdatedRule", rule.alertName));
		}

		tl.debug(JSON.stringify(responseObject, null, 2));
	}
}

run();