import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { AzureRMEndpoint, dispose } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { AzureRmEndpointAuthenticationScheme } from 'azure-pipelines-tasks-azure-arm-rest/constants';
import { AzureAppService  } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility';
import { AzureApplicationInsights } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-appinsights';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtils } from './operations/AzureAppServiceUtils';
import { KuduServiceUtils } from './operations/KuduServiceUtils';
import { AzureResourceFilterUtils } from './operations/AzureResourceFilterUtils';
import { enableContinuousMonitoring } from './operations/ContinuousMonitoringUtils';
import publishProfileUtility = require("azure-pipelines-tasks-utility-common/publishProfileUtility");

const webAppKindMap = new Map([
    [ 'app', 'webApp' ],
    [ 'app,linux', 'webAppLinux' ],
    [ 'app,container', 'webAppContainer']
]);
const defaultslotname:string = "production";

async function advancedSlotSwap(updateDeploymentStatus: boolean, appServiceSourceSlot: AzureAppService, appServiceTargetSlot: AzureAppService, appServiceSourceSlotUtils: AzureAppServiceUtility, appServiceTargetSlotUtils: AzureAppServiceUtility) {

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
    
    return updateDeploymentStatus;
}

async function run() {
    let kuduService: Kudu;
    let kuduServiceUtils: KuduServiceUtils;
    let appService: AzureAppService;
    let azureAppServiceUtils: AzureAppServiceUtility;
    let appServiceSourceSlot: AzureAppService;
    let appServiceTargetSlot: AzureAppService;
    let appServiceSourceSlotUtils: AzureAppServiceUtility;
    let appServiceTargetSlotUtils: AzureAppServiceUtility;
    let taskResult = true;
    let errorMessage: string = "";
    let updateDeploymentStatus: boolean = true;
    let action: string;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        action = tl.getInput('Action', true);
        let connectedServiceName = tl.getInput('ConnectedServiceName', true);
        let webAppName: string = tl.getInput('WebAppName', true);
        let resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        let specifySlotFlag: boolean = tl.getBoolInput('SpecifySlot', false);
        let slotName: string = specifySlotFlag || (action == "Delete Slot" || action == "Cancel Swap") ? tl.getInput('Slot', false) : null;
        let appInsightsResourceGroupName: string = tl.getInput('AppInsightsResourceGroupName', false);
        let appInsightsResourceName: string = tl.getInput('ApplicationInsightsResourceName', false);
        let sourceSlot: string = tl.getInput('SourceSlot', false);
        let swapWithProduction = tl.getBoolInput('SwapWithProduction', false);
        let targetSlot: string = tl.getInput('TargetSlot', false);
        let preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);
        let extensionList = tl.getInput('ExtensionsList', false);
        let extensionOutputVariables = tl.getInput('OutputVariable');
        let appInsightsWebTestName = tl.getInput('ApplicationInsightsWebTestName', false);
        let azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();

        let endpointTelemetry = '{"endpointId":"' + connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureAppServiceManage]" + endpointTelemetry);

        if (azureEndpoint.scheme && azureEndpoint.scheme.toLowerCase() === AzureRmEndpointAuthenticationScheme.PublishProfile) {
            if (action !== "Start all continuous webjobs" && action !== "Stop all continuous webjobs" && action !== "Install Extensions") {
                throw Error(tl.loc('InvalidActionForPublishProfileEndpoint'));
            }
            let scmCreds: publishProfileUtility.ScmCredentials = await publishProfileUtility.getSCMCredentialsFromPublishProfile(azureEndpoint.PublishProfile);
            const buffer =  new Buffer(scmCreds.username + ':' + scmCreds.password);
            const auth = buffer.toString("base64");
            var authHeader = "Basic " + auth;
            
            tl.debug("Kudu: using basic authentication for publish profile");            
            console.log('##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureAppServiceDeployment]{"authMethod":"Basic"}');

            kuduService = new Kudu(scmCreds.scmUri, authHeader);
            kuduServiceUtils = new KuduServiceUtils(kuduService);
        } else {
            if(action != "Swap Slots" && !slotName) {
                resourceGroupName = await AzureResourceFilterUtils.getResourceGroupName(azureEndpoint, 'Microsoft.Web/Sites', webAppName);
            }

            tl.debug(`Resource Group: ${resourceGroupName}`);

            appService = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
            azureAppServiceUtils = new AzureAppServiceUtility(appService);
            let appServiceKuduService = await azureAppServiceUtils.getKuduService();
            kuduServiceUtils = new KuduServiceUtils(appServiceKuduService);

            let configSettings = await appService.get(true);
            let WebAppKind = webAppKindMap.get(configSettings.kind) ? webAppKindMap.get(configSettings.kind) : configSettings.kind;
            let isLinuxApp = WebAppKind && WebAppKind.indexOf("linux") !=-1;
            let isContainerApp = WebAppKind && WebAppKind.indexOf("container") !=-1;
    
            if((action == "Start Swap With Preview" || action == "Complete Swap" || action == "Cancel Swap") && (isLinuxApp || isContainerApp))
            {
                throw Error(tl.loc('SwapWithPreviewNotsupported'));
            }
            if(action == "Swap Slots" || action == "Start Swap With Preview" || action == "Complete Swap")
            {
                targetSlot = (swapWithProduction) ? "production" : targetSlot;
                appServiceSourceSlot = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, sourceSlot);
                appServiceTargetSlot = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, targetSlot);
                appServiceSourceSlotUtils = new AzureAppServiceUtility(appServiceSourceSlot);
                appServiceTargetSlotUtils = new AzureAppServiceUtility(appServiceTargetSlot);
            }
        }

        switch(action) {
            case "Start Azure App Service": {
                await appService.start();
                await AzureAppServiceUtils.monitorApplicationState(appService, "running");
                await azureAppServiceUtils.pingApplication();
                break;
            }
            case "Stop Azure App Service": {
                await appService.stop();
                await AzureAppServiceUtils.monitorApplicationState(appService, "stopped");
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
            case "Complete Swap":
            case "Swap Slots": {
                updateDeploymentStatus = await advancedSlotSwap(updateDeploymentStatus, appServiceSourceSlot, appServiceTargetSlot, appServiceSourceSlotUtils, appServiceTargetSlotUtils);
                await appServiceSourceSlot.swap(targetSlot, preserveVnet);
                break;
            }
            case "Start Swap With Preview": {
                updateDeploymentStatus = await advancedSlotSwap(updateDeploymentStatus, appServiceSourceSlot, appServiceTargetSlot, appServiceSourceSlotUtils, appServiceTargetSlotUtils);
                await appServiceSourceSlot.swapSlotWithPreview(targetSlot, preserveVnet);
                break;
            }
            case "Cancel Swap": {
                appServiceSourceSlot = new AzureAppService(azureEndpoint, resourceGroupName, webAppName, slotName);
                appServiceSourceSlot.cancelSwapSlotWithPreview();
                break;
            }
            case "Start all continuous webjobs": {
                await kuduServiceUtils.startContinuousWebJobs();
                break;
            }
            case "Stop all continuous webjobs": {
                await kuduServiceUtils.stopContinuousWebJobs();
                break;
            }
            case "Install Extensions": {
                let extensionOutputVariablesArray = (extensionOutputVariables) ? extensionOutputVariables.split(',') : [];
                await kuduServiceUtils.installSiteExtensions(extensionList.split(','), extensionOutputVariablesArray);
                break;
            }
            case "Enable Continuous Monitoring": {
                let appInsights: AzureApplicationInsights = new AzureApplicationInsights(azureEndpoint, appInsightsResourceGroupName, appInsightsResourceName);
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
            case "Complete Swap":
            case "Swap Slots": {
                if(appServiceSourceSlotUtils && appServiceTargetSlotUtils && updateDeploymentStatus) {
                    let sourceSlotKuduService = await appServiceSourceSlotUtils.getKuduService();
                    let targetSlotKuduService = await appServiceTargetSlotUtils.getKuduService();
                    let sourceSlotKuduServiceUtils = new KuduServiceUtils(sourceSlotKuduService);
                    let targetSlotKuduServiceUtils = new KuduServiceUtils(targetSlotKuduService);
                    let customMessage = {
                        'type': 'SlotSwap',
                        'sourceSlot': appServiceSourceSlot.getSlot(),
                        'targetSlot': appServiceTargetSlot.getSlot()
                    }
                    let DeploymentID = await sourceSlotKuduServiceUtils.updateDeploymentStatus(taskResult, null, customMessage);
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