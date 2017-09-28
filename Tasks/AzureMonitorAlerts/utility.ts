import * as tl from "vsts-task-lib/task";

export function getDeploymentUri(): string {
    let buildUri: string = tl.getVariable("Build.BuildUri");
    let releaseUri: string = tl.getVariable("Release.ReleaseUri");
    
    if(!!buildUri) {
        return buildUri;
    }
    
    if(!!releaseUri) {
        return releaseUri;
    }

    return "VSTS";
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
        ">": "gt",
        ">=": "gte",
        "<": "lt",
        "<=": "lte"
    }

    return operatorMap[operator] || "";
}