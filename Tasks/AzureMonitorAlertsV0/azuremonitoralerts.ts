import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";

import { AzureEndpoint, IAzureMetricAlertRulesList } from 'azure-arm-rest-v2/azureModels';

import { AzureMonitorAlertsUtility } from './operations/AzureMonitorAlertsUtility'
import { AzureRMEndpoint } from 'azure-arm-rest-v2/azure-arm-endpoint';

async function run() {
	try {
		tl.setResourcePath(path.join(__dirname, "task.json"));
		tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));

		console.log("##vso[task.logissue type=warning]" + tl.loc("DeprecatedTask"));
		
		let connectedServiceName: string = tl.getInput("ConnectedServiceName", true);
		let resourceGroupName: string = tl.getInput("ResourceGroupName", true);
		let resourceType: string = tl.getInput("ResourceType", true);
		let resourceName: string = tl.getInput("ResourceName", true);
		let alertRules: IAzureMetricAlertRulesList = JSON.parse(tl.getInput("AlertRules", true));
		let notifyServiceOwners: boolean = tl.getInput("NotifyServiceOwners") && tl.getInput("NotifyServiceOwners").toLowerCase() === "true" ? true : false;
		let notifyEmails: string = tl.getInput("NotifyEmails");

		var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
		let azureMonitorAlertsUtility :AzureMonitorAlertsUtility = new AzureMonitorAlertsUtility(azureEndpoint, resourceGroupName, resourceType, resourceName);
		await azureMonitorAlertsUtility.addOrUpdateAlertRules(alertRules.rules, notifyServiceOwners, notifyEmails);
	}
	catch (error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}


run();