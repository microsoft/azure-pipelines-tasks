export interface IAzureRestUtilityResponse {
	statusCode?: number;
	statusMessage?: string;
	responseBody?: any;
	errorMessage?: string;
}

export interface IThresholdRuleConditionDataSource {
	"odata.type": string;
	resourceUri: string;
	metricName: string;
	operator: string;
}

export interface IThresholdRuleCondition {
	"odata.type": string; // "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition"
	dataSource: IThresholdRuleConditionDataSource;
	threshold: string;
	windowSize: string;
}

export interface IAzureMetricAlertRequestBodyProperties {
	name: string;
	description?: string;
	isEnabled: boolean;
	condition: IThresholdRuleCondition;
	actions: IRuleEmailAction[];
}

export interface IRuleEmailAction {
	"odata.type": string; //"Microsoft.Azure.Management.Insights.Models.RuleEmailAction",
	sendToServiceOwners: boolean;
	customEmails: string[]
}

export interface IAzureMetricAlertRequestBody {
	location: string;
	tags: { [key: string] : string };
	properties: IAzureMetricAlertRequestBodyProperties;
}

export interface IAzureMetricAlertRule {
	alertName: string;
	metric: string;
	thresholdCondition: string;
	thresholdValue: string;
	timePeriod: string;
}

// come up with a cool name 
export interface IAzureMetricAlertRulesList {
	resourceId: string;
	rules: IAzureMetricAlertRule[];
}