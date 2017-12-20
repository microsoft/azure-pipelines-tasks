import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import {AzureAppService  } from 'azure-arm-rest/azure-arm-app-service';
// import { AzureAppService } from 'azure-arm-rest/AzureAppService';
import { AzureApplicationInsights } from 'azure-arm-rest/azure-arm-appinsights';
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { ApplicationInsightsWebTests } from 'azure-arm-rest/azure-arm-appinsights-webtests';
import { Resources } from 'azure-arm-rest/azure-arm-resource';

const APPLICATION_INSIGHTS_EXTENSION_NAME: string = "Microsoft.ApplicationInsights.AzureWebSites";
const pingApplicationCount: number = 1;
const productionSlot: string = "production";

async function enableContinuousMonitoring(appService: AzureAppService, appInsights: AzureApplicationInsights) {
    var appDetails = await appService.get();
    var appInsightsResource = await appInsights.get();
    var appInsightsWebTests = new ApplicationInsightsWebTests(appInsights.getEndpoint(), appInsights.getResourceGroupName());
    var webDeployPublishingProfile = await appService.getWebDeployPublishingProfile();
    var applicationUrl = webDeployPublishingProfile.destinationAppUrl;
    if(appDetails.kind.indexOf("linux") == -1) {
        var appKuduService = await appService.getKuduService();
        await appKuduService.installSiteExtension(APPLICATION_INSIGHTS_EXTENSION_NAME);
    }

    appInsightsResource.tags["hidden-link:" + appDetails.id] = "Resource";
    tl.debug('Link app insights with app service via tag');
    await appInsights.update(appInsightsResource);
    tl.debug('Link app service with app insights via instrumentation key');
    await appService.patchApplicationSettings({"APPINSIGHTS_INSTRUMENTATIONKEY": appInsightsResource.properties['InstrumentationKey']});
    try {
        tl.debug('Enable alwaysOn property for app service.');
        await appService.patchConfiguration({"alwaysOn": true});    
    }
    catch(error) {
        tl.warning(error);
    }
    
    try {
        tl.debug('add web test for app service - app insights');
        await appInsightsWebTests.addWebTest(appInsightsResource, applicationUrl);
    }
    catch(error) {
        tl.warning(error);
    }
}


async function updateDeploymentStatusInKudu(kuduService: Kudu, taskResult: boolean, DeploymentID: string, customMessage: any) {
    try {
        return await kuduService.updateDeployment(taskResult, DeploymentID, customMessage);
    }
    catch(error) {
        tl.warning(error);
    }
}

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var action = tl.getInput('Action', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var specifySlotFlag: boolean = tl.getBoolInput('SpecifySlot', false);
        var slotName: string = specifySlotFlag ? tl.getInput('Slot', false) : null;
        var appInsightsResourceGroupName: string = tl.getInput('AppInsightsResourceGroupName', false);
        var appInsightsResourceName: string = tl.getInput('ApplicationInsightsResourceName', false);
        var sourceSlot: string = tl.getInput('SourceSlot', false);
        var swapWithProduction = tl.getBoolInput('SwapWithProduction', false);
        var targetSlot: string = tl.getInput('TargetSlot', false);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);
        var extensionList = tl.getInput('ExtensionsList', false);
        var extensionOutputVariables = tl.getInput('OutputVariable');
        var taskResult = true;
        var errorMessage: string = "";
        var updateDeploymentStatus: boolean = true;

        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        var resources: Array<any> = await new Resources(azureEndpoint).getResources('Microsoft.Web/Sites', webAppName);

        if(action != "Swap Slots" && !slotName) {
            if(!resources || resources.length == 0) {
                throw new Error(tl.loc('ResourceDoesntExist', webAppName));
            }
            else if(resources.length == 1) {
                resourceGroupName = resources[0].id.split("/")[4];
            }
            else {
                throw new Error(tl.loc('MultipleResourceGroupFoundForAppService', webAppName));
            }
        }

        tl.debug(`Resource Group: ${resourceGroupName}`);    
        switch(action) {
            case "Start Azure App Service": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                await appService.start();
                await appService.monitorAppState("running");
                await appService.pingApplication(pingApplicationCount);
                break;
            }
            case "Stop Azure App Service": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                await appService.stop();
                await appService.monitorAppState("stopped");
                await appService.pingApplication(pingApplicationCount);
                break;
            }
            case "Restart Azure App Service": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                await appService.restart();
                break;
            }
            case "Swap Slots": {
                targetSlot = (swapWithProduction) ? productionSlot : targetSlot;
                var appServiceSourceSlot: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, sourceSlot);
                var appServiceTargetSlot: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, targetSlot);
                if(appServiceSourceSlot.getSlot().toLowerCase() == appServiceTargetSlot.getSlot().toLowerCase()) {
                    updateDeploymentStatus = false;
                    throw new Error(tl.loc('SourceAndTargetSlotCannotBeSame'));

                }
                console.log(tl.loc('WarmingUpSlots'));
                await appServiceSourceSlot.pingApplication(1);
                await appServiceTargetSlot.pingApplication(1);
                await appServiceSourceSlot.swap(targetSlot, preserveVnet);
                break;
            }
            case "Start all continuous webjobs": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                var appServiceKuduService = await appService.getKuduService();
                console.log(tl.loc('StartingContinousWebJobs'));
                await appServiceKuduService.startContinuousWebJobs();
                console.log(tl.loc('StartedContinousWebJobs'));
                break;
            }
            case "Stop all continuous webjobs": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                var appServiceKuduService = await appService.getKuduService();
                console.log(tl.loc('StoppingContinousWebJobs'));
                await appServiceKuduService.stopContinuousWebJobs();
                console.log(tl.loc('StoppedContinousWebJobs'));
                break;
            }
            case "Install Extensions": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                var appServiceKuduService = await appService.getKuduService();
                var extensionOutputVariablesArray = (extensionOutputVariables) ? extensionOutputVariables.split(',') : [];
                await appServiceKuduService.installSiteExtensions(extensionList.split(','), extensionOutputVariablesArray);
                break;
            }
            case "Enable Continuous Monitoring": {
                var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                var appInsights: AzureApplicationInsights = new AzureApplicationInsights(azureEndpoint, appInsightsResourceGroupName, appInsightsResourceName);
                try {
                    await enableContinuousMonitoring(appService, appInsights);
                }
                catch(error) {
                    throw new Error(tl.loc('FailedToEnableContinuousMonitoring', error));
                }
                console.log(tl.loc("ContinousMonitoringEnabled", webAppName));
                break;
            }
            default: {
                throw Error(tl.loc('InvalidAction'));
            }
        }
    }
    catch(exception) {
        taskResult = false;
        errorMessage = exception;
    }

    tl.debug('Completed action');
    try {
        switch(action) {
            case "Swap Slots": {
                if(appServiceSourceSlot && appServiceTargetSlot && updateDeploymentStatus) {
                    var sourceSlotKuduService = await appServiceSourceSlot.getKuduService();
                    var targetSlotKuduService = await appServiceTargetSlot.getKuduService();
                    var customMessage = {
                        'type': 'SlotSwap',
                        'sourceSlot': appServiceSourceSlot.getSlot(),
                        'targetSlot': appServiceTargetSlot.getSlot()
                    }
                    var DeploymentID = await updateDeploymentStatusInKudu(sourceSlotKuduService, taskResult, null, customMessage);
                    await updateDeploymentStatusInKudu(targetSlotKuduService, taskResult, DeploymentID, customMessage);
                }
                break;
            }
            case "Install Extensions": {
                if(appServiceKuduService) {
                    await updateDeploymentStatusInKudu(appServiceKuduService, taskResult, null, {"type": action});
                }
                break;
            }
            default: {
                tl.debug(`deployment status not updated for action: ${action}`);
            }

        }
    }
    catch(error) {
        tl.debug(error);
    }

    if (!taskResult) {
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

run();