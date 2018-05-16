import * as tl from "vsts-task-lib/task";

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