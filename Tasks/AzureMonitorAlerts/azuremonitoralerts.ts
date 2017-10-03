import * as tl from "vsts-task-lib/task";
import * as path from "path";

import { initializeAzureRMEndpointData } from "azurestack-common/azurestackrestutility";

import { AzureRmRestClient } from "./AzureRmRestClient";
import { 
	IAzureMetricAlertRulesList,
	IAzureMetricAlertRule 
} from "./Interfaces";

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
		let storedResourceId: string = alertRules.resourceId;

		// compare the resource id with the one stored in alertRule json and throw error if it does not match 
		// this check will fail for $variables 
		if(!!storedResourceId && storedResourceId.toLowerCase() !== resourceId.toLowerCase()) {
			throw new Error(tl.loc("ResourceIdMismatchError", resourceId.toLowerCase(), storedResourceId.toLowerCase()));
		}

		await addOrUpdateAlertRules(endpoint, resourceGroupName, resourceId, alertRules.rules, notifyServiceOwners, notifyEmails);
	}
	catch (error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

async function addOrUpdateAlertRules(endpoint, resourceGroupName: string, resourceId: string, alertRules: IAzureMetricAlertRule[], notifyServiceOwners: boolean, notifyEmails: string) {
	
	let azureRmRestClient = new AzureRmRestClient(endpoint);

	for(let rule of alertRules) {
		
		console.log(tl.loc("ProcessingRule", rule.alertName));
		let responseObject = await azureRmRestClient.addOrUpdateAzureMetricAlertRule(resourceGroupName, resourceId, rule, notifyServiceOwners, notifyEmails);
		console.log(tl.loc("UpdatedRule", rule.alertName));
		tl.debug(JSON.stringify(responseObject, null, 2));
	}
}

run();