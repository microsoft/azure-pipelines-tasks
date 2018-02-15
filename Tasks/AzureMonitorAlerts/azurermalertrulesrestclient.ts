import * as tl from "vsts-task-lib/task";
import * as Q from "q";
import { 
	HttpClient, 
	HttpClientResponse 
} from "typed-rest-client/HttpClient";

import { 
	RestClient, 
	IRequestOptions, 
	IRestResponse 
} from "typed-rest-client/RestClient";

import { IRequestOptions as IHttpRequestOptions } from "typed-rest-client/Interfaces";

import { AuthorizationClient } from "./authorizationclient";

import * as Util from "./utility";
import { 
	IAzureMetricAlertRequestBody,
	IAzureMetricAlertRule
} from "./interfaces";

export class AzureRmAlertRulesRestClient {
	constructor(endpoint) {
		this._endpoint = endpoint;

		let proxyUrl: string = tl.getVariable("agent.proxyurl"); 
		let requestOptions: IHttpRequestOptions = !!proxyUrl ? { 
			proxy: { 
				proxyUrl: proxyUrl, 
				proxyUsername: tl.getVariable("agent.proxyusername"), 
				proxyPassword: tl.getVariable("agent.proxypassword"), 
				proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null 
			}
		} : null; 

		this._httpClient = new HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);
		this._restClient = new RestClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, null, requestOptions);
		this._authorizationClient = new AuthorizationClient(endpoint, this._httpClient);
	}

	public async getAzureRmAlertRule(
		resourceGroupName: string, 
		alertRuleName: string) : Promise<any> {

		let deferred: Q.Deferred<any> = Q.defer<any>();

		tl.debug(`Getting AzureRm alert rule - '${alertRuleName}' in resource group '${resourceGroupName}'`);

		let accessToken: string = await this._authorizationClient.getBearerToken();
		let apiVersion: string = "2016-03-01";
		let restUrl: string = `${this._endpoint.url}subscriptions/${this._endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.insights/alertrules/${alertRuleName}?api-version=${apiVersion}`;
		let restOptions: IRequestOptions = {
			additionalHeaders: {
				"Authorization": "Bearer " + accessToken
			}	
		};

		tl.debug(`Requesting : ${restUrl}`);

		this._restClient.get(restUrl, restOptions)
			.then((response: IRestResponse<any>) => {
				if(response.statusCode === 200) {
					deferred.resolve(response.result);
				}
				else {
					tl.debug(`Getting AzureRm alert '${alertRuleName}' failed. Response : \n${JSON.stringify(response, null, 2)}`);
					deferred.reject(response.statusCode);
				}
			}, (error) => {
				deferred.reject(error);
			}
		);

		return deferred.promise;
	}

	public async addOrUpdateAzureMetricAlertRule(
		resourceGroupName: string, 
		resourceUri: string, 
		rule: IAzureMetricAlertRule, 
		notifyServiceOwners: boolean, 
		notifyEmails: string) : Promise<IRestResponse<any>> {
		
		let deferred: Q.Deferred<IRestResponse<any>> = Q.defer<IRestResponse<any>>();
		
		let requestBody: IAzureMetricAlertRequestBody = await this._getRequestBodyForAddingAlertRule(resourceGroupName, resourceUri, rule, notifyServiceOwners, notifyEmails);

		tl.debug(`Sending PUT request with request body \n${JSON.stringify(requestBody, null, 2)}`); 

		let accessToken: string = await this._authorizationClient.getBearerToken();
		let apiVersion = "2016-03-01";
		let restUrl = `${this._endpoint.url}subscriptions/${this._endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.insights/alertrules/${rule.alertName}?api-version=${apiVersion}`;
		let restOptions: IRequestOptions = {
			additionalHeaders: {
				"Authorization": "Bearer " + accessToken
			}
		};

		tl.debug(`Requesting : ${restUrl}`);

		this._restClient.replace(restUrl, requestBody, restOptions)
			.then((response: IRestResponse<any>) => {
				if(response.statusCode === 200 || response.statusCode === 201) {
					deferred.resolve(response);
				}
				else {
					tl.debug(`Updating the rule ${rule.alertName} failed. Response: \n${JSON.stringify(response, null, 2)}`);
					deferred.reject(response.statusCode);
				}
			}, (error) => {
				deferred.reject(error);
			}
		);

		return deferred.promise;
	}

	private async _getRequestBodyForAddingAlertRule(
		resourceGroupName: string, 
		resourceUri: string, 
		rule: IAzureMetricAlertRule, 
		notifyServiceOwners: boolean, 
		notifyEmails: string) : Promise<any> {

		let existingAlertRule: any;
		let notifyViaEmails: boolean = notifyServiceOwners || !!notifyEmails;

		try {
			console.log(tl.loc("AlertRuleCheck", rule.alertName, resourceGroupName));
		
			existingAlertRule = await this.getAzureRmAlertRule(resourceGroupName, rule.alertName);

			let existingAlertRuleTargetResourceUri: string = existingAlertRule["properties"].condition.dataSource.resourceUri;
			if(existingAlertRuleTargetResourceUri && existingAlertRuleTargetResourceUri.toLowerCase() !== resourceUri.toLowerCase()) {
				return Q.reject(tl.loc("AlertRuleTargetResourceIdMismatchError", rule.alertName, existingAlertRuleTargetResourceUri));
			}

			console.log(tl.loc("AlertRuleExists", rule.alertName, resourceGroupName));
		}
		catch (error) {
			if(error === 404) {
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
				description: `Updated via ${Util.getDeploymentUri()}`, 
				isEnabled: true,
				condition: {
					"odata.type": "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition",
					"dataSource": {
						"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
						"resourceUri": resourceUri,
						"metricName": rule.metric.value
					},
					"operator": Util.getThresholdConditionForMetricAlertRule(rule.thresholdCondition),
					"threshold": rule.thresholdValue,
					"windowSize": Util.getWindowSizeForMetricAlertRule(rule.timePeriod)
				},
				actions: alertRuleActions 
			}
		} as IAzureMetricAlertRequestBody;
	}

	public async getAzureRmResourceDetails(
		resourceUri: string) : Promise<any> {
		
		let deferred: Q.Deferred<any> = Q.defer<any>();

		let splittedResourceUri: string[] = resourceUri.split("/");
		let resourceGroupName: string = splittedResourceUri[4];
		let resourceType: string = splittedResourceUri[6] + "/" +  splittedResourceUri[7];
		let resourceName: string = splittedResourceUri[8];

		tl.debug(`Getting AzureRm resource details - '${resourceName}' in resource group '${resourceGroupName}'`);
		
		let accessToken: string = await this._authorizationClient.getBearerToken();
		let apiVersion = "2017-05-10";
		let restUrl = `${this._endpoint.url}subscriptions/${this._endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/resources?$filter=resourceType EQ '${resourceType}' AND name EQ '${resourceName}'&api-version=${apiVersion}`;
		let restOptions: IRequestOptions = {
			additionalHeaders: {
				"Authorization": "Bearer " + accessToken
			}
		};

		tl.debug(`Requesting : ${restUrl}`);
		
		this._restClient.get(restUrl, restOptions)
			.then((response: IRestResponse<any>) => {
				if(response.statusCode === 200) {
					deferred.resolve(response.result["value"][0]);
				}
				else {
					tl.debug(`Getting AzureRm resource '${resourceName}' failed. Response: ${JSON.stringify(response, null, 2)}`);
					deferred.reject(response.statusCode);
				}
			}, (error) => {
				deferred.reject(error);
			}
		);
			
		return deferred.promise;
	}

	private _endpoint: any; // TODO : get the correct interface for endpoint
	private _httpClient: HttpClient;
	private _restClient: RestClient;
	private _authorizationClient: AuthorizationClient;
}