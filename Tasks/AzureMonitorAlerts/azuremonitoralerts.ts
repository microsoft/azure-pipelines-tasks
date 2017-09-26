import * as tl from "vsts-task-lib/task";
import * as Q from "q";
import * as path from "path";

import * as  azureRmUtility from "azurerest-common/azurerestutility";
import { initializeAzureRMEndpointData } from "azurestack-common/azurestackrestutility";
import { 
	IAzureRestUtilityResponse,
	IAzureMetricAlertRulesList,
	IAzureMetricAlertRule
 } from "azurerest-common/Interfaces";

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
		if (typeof error === 'object') {
            if (!error.message) {
                error = JSON.stringify(error, null, 2);
            }
        }
        
        tl.setResult(tl.TaskResult.Failed, error);
	}
}

async function addOrUpdateAlertRules(endpoint, resourceGroupName: string, resourceId: string, alertRules: IAzureMetricAlertRule[], notifyServiceOwners: boolean, notifyEmails: string) {
	
	for(var i in alertRules) {
		tl.debug(`Processing rule '${alertRules[i].alertName}'`);
		
		let responseObject: IAzureRestUtilityResponse = await azureRmUtility.addOrUpdateAzureMetricAlertRule(endpoint, resourceGroupName, resourceId, alertRules[i], notifyServiceOwners, notifyEmails);
		
		tl.debug(`Status : ${responseObject.statusCode} ${responseObject.statusMessage}`);
		tl.debug(JSON.stringify(responseObject.responseBody, null, 2));
	}
}

run();