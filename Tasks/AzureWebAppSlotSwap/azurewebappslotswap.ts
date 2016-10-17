import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import httpClient = require('vso-node-api/HttpClient');

var azureRmUtil = require ('./azurermutil.js');
var kuduDeploymentLog = require('./kududeploymentlog.js');

var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

var armUrl = 'https://management.azure.com/';
var azureApiVersion = 'api-version=2015-08-01';

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

        if(swapWithProduction)
            targetSlot = "production";

        if(sourceSlot === targetSlot){
            updateSlotSwapStatus = false;
            throw new Error(tl.loc("SourceAndTargetSlotCannotBeSame"));
        }
    
        var isSlotSwapSuccess = true;
        var SPN: ISPN = initializeSPN(connectedServiceName);
        var accessToken = await azureRmUtil.getAuthorizationToken(SPN);

        tl._writeLine(await swapWebAppSlot(SPN, accessToken, resourceGroupName, webAppName, sourceSlot, targetSlot, preserveVnet));
    }
    catch(error)
    {
        isSlotSwapSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    if(updateSlotSwapStatus){
        try{
            var deploymentId = kuduDeploymentLog.generateDeploymentId();
            //push swap slot log to sourceSlot url
            var sourcePublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, resourceGroupName, webAppName, sourceSlot);
            tl._writeLine(await azureRmUtil.updateSlotSwapStatus(sourcePublishingProfile, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot));

            //push swap slot log to targetSlot url
            var destinationPublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, resourceGroupName, webAppName, targetSlot);
            tl._writeLine(await azureRmUtil.updateSlotSwapStatus(destinationPublishingProfile, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot));
        }
        catch(error) {
            tl.warning(error);
        }
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

function swapWebAppSlot(SPN: ISPN, accessToken: any, resourceGroupName: string, webAppName: string, sourceSlot: string, targetSlot: string,preserveVnet: boolean): Q.Promise<string> {
    var url = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + "/slots/" + sourceSlot + '/slotsswap?' + azureApiVersion;

    var body = {
        targetSlot: targetSlot,
        preserveVnet: preserveVnet
    }
    var headers = {
        'Authorization': 'Bearer '+ accessToken,
        'Content-Type': 'application/json'
    };

    var deferred = Q.defer<any>();
    httpObj.send('POST', url, body, headers, (error, response, body) => {
        if(response.statusCode === 202)
        {
            deferred.resolve(tl.loc("Successfullyswappedslots", webAppName, sourceSlot, targetSlot));
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc("Failedtoswapslots",response.statusCode, webAppName));
        }
    });

    return deferred.promise;
}

run();