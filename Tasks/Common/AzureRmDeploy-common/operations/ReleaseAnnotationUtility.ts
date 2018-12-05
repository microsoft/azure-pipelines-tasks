import tl = require('vsts-task-lib/task');
import { AzureAppService } from '../azure-arm-rest/azure-arm-app-service';
import { AzureApplicationInsights, ApplicationInsightsResources} from '../azure-arm-rest/azure-arm-appinsights';
import { AzureEndpoint } from '../azure-arm-rest/azureModels';

var uuidV4 = require("uuid/v4");

export async function addReleaseAnnotation(endpoint: AzureEndpoint, azureAppService: AzureAppService, isDeploymentSuccess: boolean): Promise<void> {
    try {
        var appSettings = await azureAppService.getApplicationSettings();
        var instrumentationKey = appSettings && appSettings.properties && appSettings.properties.APPINSIGHTS_INSTRUMENTATIONKEY;
        if(instrumentationKey) {
            let appinsightsResources: ApplicationInsightsResources = new ApplicationInsightsResources(endpoint);
            var appInsightsResources = await appinsightsResources.list(null, [`$filter=InstrumentationKey eq '${instrumentationKey}'`]);
            if(appInsightsResources.length > 0) {
                var appInsights: AzureApplicationInsights = new AzureApplicationInsights(endpoint, appInsightsResources[0].id.split('/')[4], appInsightsResources[0].name);
                var releaseAnnotationData = getReleaseAnnotation(isDeploymentSuccess);
                await appInsights.addReleaseAnnotation(releaseAnnotationData);
                console.log(tl.loc("SuccessfullyAddedReleaseAnnotation", appInsightsResources[0].name));
            }
            else {
                tl.debug(`Unable to find Application Insights resource with Instrumentation key ${instrumentationKey}. Skipping adding release annotation.`);
            }
        }
        else {
            tl.debug(`Application Insights is not configured for the App Service. Skipping adding release annotation.`);
        }
    }
    catch(error) {
        console.log(tl.loc("FailedAddingReleaseAnnotation", error));
    }
}

function getReleaseAnnotation(isDeploymentSuccess: boolean): {[key: string]: any} {
    let annotationName = "Release Annotation";
    let releaseUri = tl.getVariable("Release.ReleaseUri");
    let buildUri = tl.getVariable("Build.BuildUri");

    if (!!releaseUri) {
        annotationName = `${tl.getVariable("Release.DefinitionName")} - ${tl.getVariable("Release.ReleaseName")}`;
    }
    else if (!!buildUri) {
        annotationName = `${tl.getVariable("Build.DefinitionName")} - ${tl.getVariable("Build.BuildNumber")}`;
    }
 
    let releaseAnnotationProperties = {
        "Label": isDeploymentSuccess ? "Success" : "Error", // Label decides the icon for release annotation
        "Deployment Uri": getDeploymentUri()
    };

    let releaseAnnotation = {
        "AnnotationName": annotationName,
        "Category": "Text",
        "EventTime": new Date(),
        "Id": uuidV4(),
        "Properties": JSON.stringify(releaseAnnotationProperties)
    };

    return releaseAnnotation;
}

function getDeploymentUri(): string {
    let buildUri = tl.getVariable("Build.BuildUri");
    let releaseWebUrl = tl.getVariable("Release.ReleaseWebUrl");
    let collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
    let teamProject = tl.getVariable('System.TeamProjectId');
    let buildId = tl.getVariable('build.buildId');

    if (!!releaseWebUrl) {
        return releaseWebUrl;
    }

    if (!!buildUri) {
        return `${collectionUrl}${teamProject}/_build?buildId=${buildId}&_a=summary`;
    }

    return "";
}