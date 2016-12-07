import tl = require('vsts-task-lib/task');
import path = require('path');

var azureRmUtil = require ('./azurermutil.js');
var kuduDeploymentLog = require('./kududeploymentlog.js');
var azureRESTUtility = require ('webdeployment-common/azurerestutility.js');

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', true);
        var sourceSlot: string = tl.getInput('SourceSlot', true);
        var swapWithProduction = tl.getBoolInput('SwapWithProduction', false);
        var targetSlot: string = tl.getInput('TargetSlot', false);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);

        var updateSlotSwapStatus: boolean = true;
        var errorMessage = "";

        if(swapWithProduction)
            targetSlot = "production";

        if(sourceSlot === targetSlot){
            updateSlotSwapStatus = false;
            throw new Error(tl.loc("SourceAndTargetSlotCannotBeSame"));
        }
    
        var isSlotSwapSuccess = true;
        var SPN: ISPN = initializeSPN(connectedServiceName);

        tl._writeLine(await azureRmUtil.swapWebAppSlot(SPN, resourceGroupName, webAppName, sourceSlot, targetSlot, preserveVnet));
    }
    catch(error)
    {
        isSlotSwapSuccess = false;
        errorMessage = error;
    }
    if(updateSlotSwapStatus){
        try{
            var deploymentId = kuduDeploymentLog.generateDeploymentId();
            //push swap slot log to sourceSlot url
            var sourcePublishingProfile = await azureRESTUtility.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, true, sourceSlot);
            tl._writeLine(await azureRmUtil.updateSlotSwapStatus(sourcePublishingProfile, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot));

            //push swap slot log to targetSlot url
            var destinationPublishingProfile = await azureRESTUtility.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, (!swapWithProduction), targetSlot);
            tl._writeLine(await azureRmUtil.updateSlotSwapStatus(destinationPublishingProfile, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot));
        }
        catch(error) {
            tl.warning(error);
        }
    }
    if(!isSlotSwapSuccess) {
        tl.setResult(tl.TaskResult.Failed, errorMessage);
    }
}

interface ISPN{
    servicePrincipalClientID: string,
    servicePrincipalKey: string,
    tenantID: string,
    subscriptionId: string
}

function initializeSPN(connectedServiceName: string): ISPN{
    var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);
    var subscriptionId = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
    return {
        servicePrincipalClientID: endPointAuthCreds.parameters["serviceprincipalid"],
        servicePrincipalKey: endPointAuthCreds.parameters["serviceprincipalkey"],
        tenantID: endPointAuthCreds.parameters["tenantid"],
        subscriptionId: subscriptionId
    }
}

run();