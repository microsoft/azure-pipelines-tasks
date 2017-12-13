process.env["ENDPOINT_AUTH_azureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"spId\",\"serviceprincipalkey\":\"spKey\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_DATA_azureRMSpn_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_DATA_azureRMSpn_SUBSCRIPTIONID"] =  "sId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenantId";
process.env["ENDPOINT_URL_azureRMSpn"] = "http://example.com/"
process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";

export class AuthorizationClient {
	constructor() {

	}
	
	public getBearerToken() {
		return "accessToken";
	}
}

export const mockAlertRules = {
	resourceId: "randomResourceId",
	rules: [
		{
			alertName: "Rule1",
			metric: {
				value: "metric1",
				displayValue: "metric1",
				unit: "count"
			},
			thresholdCondition: ">",
			thresholdValue: "20",
			timePeriod: "over the last 5 minutes"
		},
		{
			alertName: "Rule2",
			metric: {
				value: "metric2",
				displayValue: "metric2",
				unit: "count"
			},
			thresholdCondition: "<=",
			thresholdValue: "10",
			timePeriod: "over the last 10 minutes"
		}
	]
};

export function getMetricRequestBody(ruleName: string, location: string, operator: string, metricName: string, metricValue: string, period: string) {
	return {
		location: location,
		tags: {"hidden-link:/subscriptions/sId/resourceGroups/testRg/providers/testResource.provider/type/testResourceName": "Resource"},
		properties: {
			name: ruleName,
			description: `Updated via TEST`,  
			isEnabled: true,
			condition: {
				"odata.type": "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition",
				"dataSource": {
					"odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
					"resourceUri": "/subscriptions/sId/resourceGroups/testRg/providers/testResource.provider/type/testResourceName",
					"metricName": metricName
				},
				"operator": operator,
				"threshold": metricValue,
				"windowSize": period
			},
			actions: []
		}
	}
}

export function getUtilityMock() {
	var utility = require("../utility");	
	utility.getDeploymentUri = () => {
		return "TEST";
	}

	return utility;
}