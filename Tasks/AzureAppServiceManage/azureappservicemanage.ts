import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
var azureRmUtil = require('azurerestcall-common/azurerestutility.js');

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var action = tl.getInput('Action', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var sourceSlot: string = tl.getInput('SourceSlot', false);
        var swapWithProduction = tl.getBoolInput('SwapWithProduction', false);
        var targetSlot: string = tl.getInput('TargetSlot', false);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);
        var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
        var subscriptionId = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
        var updateSlotSwapStatus: boolean = true;
        var taskResult = true;

        var SPN = {
            servicePrincipalClientID: endPointAuthCreds.parameters["serviceprincipalid"],
            servicePrincipalKey: endPointAuthCreds.parameters["serviceprincipalkey"],
            tenantID: endPointAuthCreds.parameters["tenantid"],
            subscriptionId: subscriptionId
        };

        if(resourceGroupName === null) {
            resourceGroupName = await azureRmUtil.getResourceGroupName(SPN, webAppName);
        }
        switch(action) {
            case "Start Azure App Service": {
                tl._writeLine(tl.loc('StartingAppService', webAppName));
                tl._writeLine(await azureRmUtil.startAppService(SPN, resourceGroupName, webAppName));
                break;
            }
            case "Stop Azure App Service": {
                tl._writeLine(tl.loc('StoppingAppService', webAppName));
                tl._writeLine(await azureRmUtil.stopAppService(SPN, resourceGroupName, webAppName));
                break;
            }
            case "Restart Azure App Service": {
                tl._writeLine(tl.loc('RestartingAppService', webAppName));
                tl._writeLine(await azureRmUtil.restartAppService(SPN, resourceGroupName, webAppName));
                break;
            }
            case "SwapSlot": {
                if(swapWithProduction) {
                    targetSlot = "production";
                }
                if(sourceSlot === targetSlot){
                    updateSlotSwapStatus = false;
                    throw new Error(tl.loc("SourceAndTargetSlotCannotBeSame"));
                }
                tl._writeLine(await azureRmUtil.swapWebAppSlot(SPN, resourceGroupName, webAppName, sourceSlot, targetSlot, preserveVnet));
                break;
            }
            default:
                throw Error("Invalid Action selected !");
        }
    }
    catch(error)
    {
        taskResult = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    if(tl.getInput('Action') === "SwapSlot") {
        try{

            var customMessage = {
                type: "swapSlot",
                sourceSlot: sourceSlot,
                targetSlot: targetSlot
            };

            //push swap slot log to sourceSlot url
            var sourcePublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, true, sourceSlot);
            tl._writeLine(await azureRmUtil.updateDeploymentStatus(sourcePublishingProfile, taskResult, customMessage));

            //push swap slot log to targetSlot url
            var destinationPublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, !(swapWithProduction), targetSlot);
            tl._writeLine(await azureRmUtil.updateDeploymentStatus(destinationPublishingProfile, taskResult, customMessage));
        }
        catch(error) {
            tl.warning(error);
        }
    }
}

run();