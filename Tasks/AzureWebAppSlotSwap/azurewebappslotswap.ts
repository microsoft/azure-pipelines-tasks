import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import httpClient = require('vso-node-api/HttpClient');

var azureRmUtil = require ('./azurermutil.js');

var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

var armUrl = 'https://management.azure.com/';
var azureApiVersion = 'api-version=2015-08-01';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', true);
        var slot1: string = tl.getInput('Slot1', true);
        var swapWithProduction = tl.getBoolInput('SwapWithProduction', true);
        var slot2: string = tl.getInput('Slot2', false);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);

        if(!slot2)
            slot2 = "production";
    
        var isSlotSwapSuccess = true;
        var SPN: ISPN = azureRmUtil.initializeSPN(connectedServiceName);
        var accessToken = await azureRmUtil.getAuthorizationToken(SPN);

        tl._writeLine(await swapWebAppSlot(SPN, accessToken, resourceGroupName, webAppName, slot1, slot2, preserveVnet));
    }
    catch(error)
    {
        isSlotSwapSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    try{
        //push swap slot log to slot1 url
        var sourcePublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, resourceGroupName, webAppName, slot1);
        tl._writeLine(await azureRmUtil.updateSlotSwapStatus(sourcePublishingProfile, isSlotSwapSuccess, slot1, slot2));

        //push swap slot log to slot2 url
        var destinationPublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, resourceGroupName, webAppName, slot2);
        tl._writeLine(await azureRmUtil.updateSlotSwapStatus(destinationPublishingProfile, isSlotSwapSuccess, slot1, slot2));
    }
    catch(error) {
        tl.warning(error);
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

function swapWebAppSlot(SPN: ISPN, accessToken: any, resourceGroupName: string, webAppName: string, slot1: string, slot2: string,preserveVnet: boolean): Q.Promise<string> {
    var url = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + "/slots/" + slot1 + '/slotsswap?' + azureApiVersion;

    var body = {
        targetSlot: slot2,
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
            deferred.resolve(tl.loc("Successfullyswappedslots"));
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc("Failedtoswapslots",response.statusMessage));
        }
    });

    return deferred.promise;
}

run();