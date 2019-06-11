import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import path = require('path');
import { AzureRMEndpoint, dispose } from 'azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest-v2/azureModels';
import {AzureAppService  } from 'azure-arm-rest-v2/azure-arm-app-service';
import { AzureApplicationInsights } from 'azure-arm-rest-v2/azure-arm-appinsights';
import { Kudu } from 'azure-arm-rest-v2/azure-arm-app-service-kudu';
import { ApplicationInsightsWebTests } from 'azure-arm-rest-v2/azure-arm-appinsights-webtests';
import { Resources } from 'azure-arm-rest-v2/azure-arm-resource';
import { AzureAppServiceUtils } from './operations/AzureAppServiceUtils';
import { KuduServiceUtils } from './operations/KuduServiceUtils';
import { AzureResourceFilterUtils } from './operations/AzureResourceFilterUtils';
import { enableContinuousMonitoring } from './operations/ContinuousMonitoringUtils';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var action = tl.getInput('Action', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var specifySlotFlag: boolean = tl.getBoolInput('SpecifySlot', false);
        var slotName: string = specifySlotFlag || action == "Delete Slot" ? tl.getInput('Slot', false) : null;
        var appInsightsResourceGroupName: string = tl.getInput('AppInsightsResourceGroupName', false);
        var appInsightsResourceName: string = tl.getInput('ApplicationInsightsResourceName', false);
        var sourceSlot: string = tl.getInput('SourceSlot', false);
        var swapWithProduction = tl.getBoolInput('SwapWithProduction', false);
        var targetSlot: string = tl.getInput('TargetSlot', false);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);
        var extensionList = tl.getInput('ExtensionsList', false);
        var extensionOutputVariables = tl.getInput('OutputVariable');
        var appInsightsWebTestName = tl.getInput('ApplicationInsightsWebTestName', false);
        var taskResult = true;
        var errorMessage: string = "";
        var updateDeploymentStatus: boolean = true;
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();

        var endpointTelemetry = '{"endpointId":"' + connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureAppServiceManage]" + endpointTelemetry);
        
        if(action != "Swap Slots" && !slotName) {
            resourceGroupName = await AzureResourceFilterUtils.getResourceGroupName(azureEndpoint, 'Microsoft.Web/Sites', webAppName);
        }

        tl.debug(`Resource Group: ${resourceGroupName}`);
        var appService: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
        var azureAppServiceUtils: AzureAppServiceUtils = new AzureAppServiceUtils(appService);

        switch(action) {
            case "Start Azure App Service": {
                await appService.start();
                await azureAppServiceUtils.monitorApplicationState("running");
                await azureAppServiceUtils.pingApplication();
                break;
            }
            case "Stop Azure App Service": {
                await appService.stop();
                await azureAppServiceUtils.monitorApplicationState("stopped");
                break;
            }
            case "Restart Azure App Service": {
                await appService.restart();
                await azureAppServiceUtils.pingApplication();
                break;
            }
            case "Delete Slot": {
                await appService.delete();
                break;
            }
            case "Swap Slots": {
                targetSlot = (swapWithProduction) ? "production" : targetSlot;
                var appServiceSourceSlot: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, sourceSlot);
                var appServiceTargetSlot: AzureAppService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, targetSlot);
                var appServiceSourceSlotUtils: AzureAppServiceUtils = new AzureAppServiceUtils(appServiceSourceSlot);
                var appServiceTargetSlotUtils: AzureAppServiceUtils = new AzureAppServiceUtils(appServiceTargetSlot);

                if(appServiceSourceSlot.getSlot().toLowerCase() == appServiceTargetSlot.getSlot().toLowerCase()) {
                    updateDeploymentStatus = false;
                    throw new Error(tl.loc('SourceAndTargetSlotCannotBeSame'));
                }

                console.log(tl.loc('WarmingUpSlots'));
                try {
                    await Promise.all([appServiceSourceSlotUtils.pingApplication(), appServiceTargetSlotUtils.pingApplication()]);
                }
                catch(error) {
                    tl.debug('Failed to warm-up slots. Error: ' + error);
                }

                await appServiceSourceSlot.swap(targetSlot, preserveVnet);
                break;
            }
            case "Start all continuous webjobs": {
                var appServiceKuduService: Kudu = await azureAppServiceUtils.getKuduService();
                var kuduServiceUtils: KuduServiceUtils = new KuduServiceUtils(appServiceKuduService);
                await kuduServiceUtils.startContinuousWebJobs();
                break;
            }
            case "Stop all continuous webjobs": {
                var appServiceKuduService = await azureAppServiceUtils.getKuduService();
                var kuduServiceUtils: KuduServiceUtils = new KuduServiceUtils(appServiceKuduService);
                await kuduServiceUtils.stopContinuousWebJobs();
                break;
            }
            case "Install Extensions": {
                var appServiceKuduService = await azureAppServiceUtils.getKuduService();
                var kuduServiceUtils: KuduServiceUtils = new KuduServiceUtils(appServiceKuduService);
                var extensionOutputVariablesArray = (extensionOutputVariables) ? extensionOutputVariables.split(',') : [];
                await kuduServiceUtils.installSiteExtensions(extensionList.split(','), extensionOutputVariablesArray);
                break;
            }
            case "Enable Continuous Monitoring": {
                var appInsights: AzureApplicationInsights = new AzureApplicationInsights(azureEndpoint, appInsightsResourceGroupName, appInsightsResourceName);
                await enableContinuousMonitoring(azureEndpoint, appService, appInsights, appInsightsWebTestName);
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
                if(appServiceSourceSlotUtils && appServiceTargetSlotUtils && updateDeploymentStatus) {
                    var sourceSlotKuduService = await appServiceSourceSlotUtils.getKuduService();
                    var targetSlotKuduService = await appServiceTargetSlotUtils.getKuduService();
                    var sourceSlotKuduServiceUtils = new KuduServiceUtils(sourceSlotKuduService);
                    var targetSlotKuduServiceUtils = new KuduServiceUtils(targetSlotKuduService);
                    var customMessage = {
                        'type': 'SlotSwap',
                        'sourceSlot': appServiceSourceSlot.getSlot(),
                        'targetSlot': appServiceTargetSlot.getSlot()
                    }
                    var DeploymentID = await sourceSlotKuduServiceUtils.updateDeploymentStatus(taskResult, null, customMessage);
                    await targetSlotKuduServiceUtils.updateDeploymentStatus(taskResult, DeploymentID, customMessage);
                }
                break;
            }
            case "Install Extensions": {
                if(kuduServiceUtils) {
                    await kuduServiceUtils.updateDeploymentStatus(taskResult, null, { "type" : action });
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
    finally {
        dispose();
    }

    if (!taskResult) {
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

run();