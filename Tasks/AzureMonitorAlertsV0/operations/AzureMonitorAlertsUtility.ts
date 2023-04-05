import * as tl from "azure-pipelines-task-lib/task";
import { IAzureMetricAlertRule, AzureEndpoint, IAzureMetricAlertRequestBody } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import {AzureMonitorAlerts} from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-appinsigths-alerts';
import {Resources} from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource';
import * as Q from "q";

export class AzureMonitorAlertsUtility {
    private _azureEndpoint: AzureEndpoint;
    private _resourceGroupName: string;
    private _resourceType: string;
    private _resourceName: string;

    public constructor(azureEndpoint: AzureEndpoint, resourceGroupName: string, resourceType: string, resourceName: string) {
        this._azureEndpoint = azureEndpoint;
        this._resourceGroupName = resourceGroupName;
        this._resourceType = resourceType;
        this._resourceName = resourceName;
    }

    public async addOrUpdateAlertRules(alertRules: IAzureMetricAlertRule[], notifyServiceOwners: boolean, notifyEmails: string) {

        let resourceId: string = `/subscriptions/${this._azureEndpoint.subscriptionID}/resourceGroups/${this._resourceGroupName}/providers/${this._resourceType}/${this._resourceName}`;
        
        let azureMetricAlerts :AzureMonitorAlerts = new AzureMonitorAlerts(this._azureEndpoint, this._resourceGroupName);
        for(let rule of alertRules) {
            let requestBody: IAzureMetricAlertRequestBody = await this._getRequestBodyForAddingAlertRule(azureMetricAlerts , this._resourceGroupName, resourceId, rule, notifyServiceOwners, notifyEmails);
            await azureMetricAlerts.update(rule.alertName, requestBody);
        }
    }


    private async _getRequestBodyForAddingAlertRule(
        azureMetricAlerts :AzureMonitorAlerts,
		resourceGroupName: string, 
		resourceUri: string, 
		rule: IAzureMetricAlertRule, 
		notifyServiceOwners: boolean, 
		notifyEmails: string) : Promise<any> {

		let existingAlertRule: any;
		let notifyViaEmails: boolean = notifyServiceOwners || !!notifyEmails;

		try {
			console.log(tl.loc("AlertRuleCheck", rule.alertName, resourceGroupName));
		
			existingAlertRule = await azureMetricAlerts.get(rule.alertName);
			let existingAlertRuleTargetResourceUri: string = existingAlertRule["properties"] && existingAlertRule["properties"].condition
				&& existingAlertRule["properties"].condition.dataSource ? existingAlertRule["properties"].condition.dataSource.resourceUri: "";
			if(existingAlertRuleTargetResourceUri && existingAlertRuleTargetResourceUri.toLowerCase() !== resourceUri.toLowerCase()) {
				return Q.reject(tl.loc("AlertRuleTargetResourceIdMismatchError", rule.alertName, existingAlertRuleTargetResourceUri));
			}

			console.log(tl.loc("AlertRuleExists", rule.alertName, resourceGroupName));
		}
		catch (error) {
			if(error.toString().indexOf("404") != -1) {
				console.log(tl.loc("AlertRuleDoesNotExist", rule.alertName, resourceGroupName));
            }
		}

		let alertRuleResourceLocation: string = "";
		let alertRuleResourceTags: {[key: string]: string} = {};
		let alertRuleActions = [];

		if(existingAlertRule) {
			// if the alert rule already exists, use the location, tags and actions of the existing alert rule
			alertRuleResourceLocation = existingAlertRule.location;
			alertRuleResourceTags = existingAlertRule.tags || {};
			alertRuleActions = existingAlertRule["properties"] && existingAlertRule["properties"].actions || [];

			if(notifyViaEmails) {
				alertRuleActions = alertRuleActions.filter((action) => {
					// remove email action which will be updated later
					if(action["odata.type"]) {
						return action["odata.type"].toLowerCase() !== "microsoft.azure.management.insights.models.ruleemailaction";
					}
					return true;
				});
			}        
		}
		else {
			// For new alert rules, create the alert rule in the same location as the target resource
			let resourceMetadataResponse = await this.getAzureRmResourceDetails(resourceUri);
			alertRuleResourceLocation = resourceMetadataResponse.location;
		}

		// Add the hidden link resource tag 
		alertRuleResourceTags["hidden-link:" + resourceUri] = "Resource";
		
		// Add email action
		if(notifyViaEmails) {
			let notifyEmailsList: string[] = !!notifyEmails ? notifyEmails.split(";") : []; 
			notifyEmailsList.forEach((value, index, array) => {
				array[index] = value.trim();
			});
			notifyEmailsList = notifyEmailsList.filter((value) => !!value);

			alertRuleActions.push({ 
				"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleEmailAction",
				"sendToServiceOwners": notifyServiceOwners, 
				"customEmails": notifyEmailsList 
			});
		}

		return {
			location: alertRuleResourceLocation,
			tags: alertRuleResourceTags,
			properties: {
				name: rule.alertName,
				description: `Updated via ${getDeploymentUri()}`, 
				isEnabled: true,
				condition: {
					"odata.type": "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition",
					"dataSource": {
						"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
						"resourceUri": resourceUri,
						"metricName": rule.metric.value
					},
					"operator": getThresholdConditionForMetricAlertRule(rule.thresholdCondition),
					"threshold": rule.thresholdValue,
					"windowSize": getWindowSizeForMetricAlertRule(rule.timePeriod)
				},
				actions: alertRuleActions 
			}
		} as IAzureMetricAlertRequestBody;
    }
    
    public async getAzureRmResourceDetails(resourceUri: string) : Promise<any> {
		
		let deferred: Q.Deferred<any> = Q.defer<any>();

		let splittedResourceUri: string[] = resourceUri.split("/");
		let resourceGroupName: string = splittedResourceUri[4];
		let resourceType: string = splittedResourceUri[6] + "/" +  splittedResourceUri[7];
		let resourceName: string = splittedResourceUri[8];

		tl.debug(`Getting AzureRm resource details - '${resourceName}' in resource group '${resourceGroupName}'`);
		let resources: Resources = new Resources(this._azureEndpoint);
		let resourceValues = await resources.getResources(resourceType, resourceName);

		return resourceValues[0];
	}
}

export function getDeploymentUri(): string {
	let buildUri = tl.getVariable("Build.BuildUri");
	let releaseWebUrl = tl.getVariable("Release.ReleaseWebUrl");
	let collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri'); 
	let teamProject = tl.getVariable('System.TeamProjectId');
	let buildId = tl.getVariable('build.buildId');

	if(!!releaseWebUrl) {
		return releaseWebUrl;
	}

	if(!!buildUri) {
		return `${collectionUrl}${teamProject}/_build?buildId=${buildId}&_a=summary`;
	}
		
	return "";
}

export function getWindowSizeForMetricAlertRule(key: string): string {
	let timePeriodMap: {[key: string]: string} = {
		"over the last 5 minutes": "PT5M", 
		"over the last 10 minutes": "PT10M",
		"over the last 15 minutes": "PT15M",
		"over the last 30 minutes": "PT30M", 
		"over the last 45 minutes": "PT45M",
		"over the last hour": "PT1H", 
		"over the last 2 hours": "PT2H", 
		"over the last 3 hours": "PT3H",
		"over the last 4 hours": "PT4H",
		"over the last 5 hours": "PT5H",
		"over the last 6 hours": "PT6H",
		"over the last 24 hours": "P1D" 
	};

	return timePeriodMap[key] || "";
}

export function getThresholdConditionForMetricAlertRule(operator: string): string {
	let operatorMap: {[key: string]: string} = {
		">": "GreaterThan",
		">=": "GreaterThanOrEqual",
		"<": "LessThan",
		"<=": "LessThanOrEqual"
	}

	return operatorMap[operator] || "";
}