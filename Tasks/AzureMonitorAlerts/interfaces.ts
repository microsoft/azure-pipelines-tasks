export interface IThresholdRuleConditionDataSource {
	"odata.type": string;
	resourceUri: string;
	metricName: string;
}

export interface IThresholdRuleCondition {
	"odata.type": string; // "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition"
	dataSource: IThresholdRuleConditionDataSource;
	threshold: string;
	operator: string;
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

export interface IMetric {
	value: string;
	displayValue: string;
	unit: string;
}

export interface IAzureMetricAlertRule {
	alertName: string;
	metric: IMetric;
	thresholdCondition: string;
	thresholdValue: string;
	timePeriod: string;
}

export interface IAzureMetricAlertRulesList {
	resourceId: string;
	rules: IAzureMetricAlertRule[];
}