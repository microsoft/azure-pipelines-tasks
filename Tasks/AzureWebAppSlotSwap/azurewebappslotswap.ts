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
        var source: string = tl.getInput('Source', true);
        var destination: string = tl.getInput('Destination', true);
        var preserveVnet: boolean = tl.getBoolInput('PreserveVnet', false);
        var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);

        var isSlotSwapSuccess = true;
        var SPN = new Array();
        SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
        SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
        SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
        SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);

        await swapSlot(SPN, resourceGroupName, webAppName, source, destination, preserveVnet);
    }
    catch(error)
    {
        isSlotSwapSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    try{
        //push swap slot log to source url
        var sourcePublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, resourceGroupName, webAppName, source);
        tl._writeLine(await azureRmUtil.updateSlotSwapStatus(sourcePublishingProfile, isSlotSwapSuccess, source, destination));

        //push swap slot log to destination url
        var destinationPublishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, resourceGroupName, webAppName, destination);
        tl._writeLine(await azureRmUtil.updateSlotSwapStatus(destinationPublishingProfile, isSlotSwapSuccess, source, destination));
    }
    catch(error) {
        tl.warning(error);
    }
}

async function swapSlot(SPN, resourceGroupName: string, webAppName: string, source: string, destination: string,preserveVnet: boolean) {
    var deferred = Q.defer();
    var slotUrl = (source == "Production") ? "" : "/slots/" + source;
    var accessToken = await azureRmUtil.getAuthorizationToken(SPN);
    
    var url = armUrl + 'subscriptions/' + SPN["subscriptionId"] + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/slotsswap?' + azureApiVersion;
    
    var body = {
        targetSlot: destination,
        preserveVnet: preserveVnet
    }
    
    var headers = {
        'Authorization': 'Bearer '+ accessToken,
        'Content-Type': 'application/json'
    };

    httpObj.send('POST', url, body, headers, (error, response, body) => {
        if(response.statusCode === 202)
        {
            tl._writeLine(tl.loc("Successfullyswappedslots"));
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