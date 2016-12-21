import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
var azureRmUtil = require('azurerest-common/azurerestutility.js');
var kuduLogUtil = require('azurerest-common/kududeploymentstatusutility.js');

async function swapSlot(endPoint, resourceGroupName: string, webAppName: string, sourceSlot: string, swapWithProduction: boolean, targetSlot: string, preserveVnet: boolean) {
    if(swapWithProduction) {
        targetSlot = "production";
    }
    if(sourceSlot === targetSlot){
        throw new Error(tl.loc("SourceAndTargetSlotCannotBeSame"));
    }
    tl._writeLine(await azureRmUtil.swapWebAppSlot(endPoint, resourceGroupName, webAppName, sourceSlot, targetSlot, preserveVnet));
}

async function updateKuduDeploymentLog(endPoint, webAppName, resourceGroupName, slotFlag, slotName, taskResult, customMessage, deploymentId) {
    try {
        var publishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(endPoint, webAppName, resourceGroupName, slotFlag, slotName);
        tl._writeLine(await azureRmUtil.updateDeploymentStatus(publishingProfile, taskResult, customMessage, deploymentId));
    }
    catch(exception) {
        tl.warning(exception);
    }
}

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var action = tl.getInput('Action', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var operateOnSlot: boolean = tl.getBoolInput('SpecifySlot', false);
        var slotName: string = tl.getInput('Slot', false);
        var sourceSlot: string = tl.getInput('SourceSlot', false);
        var swapWithProduction = tl.getBoolInput('SwapWithProduction', false);
        var targetSlot: string = tl.getInput('TargetSlot', false);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);
        var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
        var subscriptionId = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
        var taskResult = true;

        var endPoint = new Array();
        endPoint["servicePrincipalClientID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalid', true);
        endPoint["servicePrincipalKey"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalkey', true);
        endPoint["tenantID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'tenantid', true);
        endPoint["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
        endPoint["url"] = tl.getEndpointUrl(connectedServiceName, true);

        if(resourceGroupName === null) {
            resourceGroupName = await azureRmUtil.getResourceGroupName(endPoint, webAppName);
        }
        switch(action) {
            case "Start Azure App Service": {
                tl._writeLine(await azureRmUtil.startAppService(endPoint, resourceGroupName, webAppName, operateOnSlot, slotName));
                break;
            }
            case "Stop Azure App Service": {
                tl._writeLine(await azureRmUtil.stopAppService(endPoint, resourceGroupName, webAppName, operateOnSlot, slotName));
                break;
            }
            case "Restart Azure App Service": {
                tl._writeLine(await azureRmUtil.restartAppService(endPoint, resourceGroupName, webAppName, operateOnSlot, slotName));
                break;
            }
            case "Swap Slots": {
                await swapSlot(endPoint, resourceGroupName, webAppName, sourceSlot, swapWithProduction, targetSlot, preserveVnet);
                break;
            }
            default:
                throw Error(tl.loc('InvalidAction'));
        }
    }
    catch(exception)
    {
        taskResult = false;
        tl.setResult(tl.TaskResult.Failed, exception);
    }
    var customMessage = {
        type: action
    }
    var deploymentId = kuduLogUtil.generateDeploymentId();

    if(action === "Swap Slots") {
        customMessage['type'] = 'SlotSwap'; // for Ibiza CD flow
        customMessage['sourceSlot'] = sourceSlot;
        customMessage['targetSlot'] = swapWithProduction ? "Production" : targetSlot;

        await updateKuduDeploymentLog(endPoint, webAppName, resourceGroupName, true, sourceSlot, taskResult, customMessage, deploymentId);
        await updateKuduDeploymentLog(endPoint, webAppName, resourceGroupName, !(swapWithProduction), targetSlot, taskResult, customMessage, deploymentId);
    }
    else {
        customMessage['slotName'] =  (operateOnSlot) ? slotName : 'Production';
        await updateKuduDeploymentLog(endPoint, webAppName, resourceGroupName, operateOnSlot, slotName, taskResult, customMessage, deploymentId);
    }
}

run();