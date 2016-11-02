var adal = require ('adal-node');
var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

var kuduDeploymentLog = require('./kududeploymentlog.js');

var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestClient(httpObj);

var AuthenticationContext = adal.AuthenticationContext;
var authUrl = 'https://login.windows.net/';
var armUrl = 'https://management.azure.com/';
var azureApiVersion = 'api-version=2015-08-01';

/**
 * updates the slot swap status in kudu service
 * 
 * @param   publishingProfile     Publish Profile details
 * @param   isSlotSwapSuccess     Status of Slot Swap
 * @param   sourceSlot            Name of source slot for swap
 * @param   targetSlot            Name of target slot for swap
 * 
 * @returns promise with string
 */
export function updateSlotSwapStatus(publishingProfile, deploymentId: string, isSlotSwapSuccess: boolean, sourceSlot: string, targetSlot: string): Q.Promise<string>  {
    var deferred = Q.defer<string>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    var msDeploySite = publishingProfile.msdeploySite;
    if(webAppPublishKuduUrl) {
        var requestDetails = kuduDeploymentLog.getUpdateHistoryRequest(webAppPublishKuduUrl, deploymentId, isSlotSwapSuccess, sourceSlot, targetSlot);
        var accessToken = 'Basic ' + (new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64'));
        var headers = {
            authorization: accessToken
        };

        restObj.replace(requestDetails['requestUrl'], null, requestDetails['requestBody'], headers, null,
            (error, response, body) => {
                if(error) {
                    deferred.reject(error);
                }
                else if(response === 200) {
                    deferred.resolve(tl.loc("Successfullyupdatedslotswaphistory", body.url, msDeploySite));
                }
                else {
                    tl.warning(body);
                    deferred.reject(tl.loc("Failedtoupdateslotswaphistory", msDeploySite));
                }
        });
    }
    else {
        deferred.reject(tl.loc('WARNINGCannotupdateslotswapstatusSCMendpointisnotenabledforthiswebsite'));
    }

    return deferred.promise;
}

/**
 * Gets the Azure RM Web App Connections details from SPN
 * 
 * @param   SPN                 Service Principal Name
 * @param   webAppName          Name of the web App
 * @param   resourceGroupName   Resource Group Name
 * @param   slotName            Name of the slot
 * 
 * @returns (JSON)            
 */
export async function getAzureRMWebAppPublishProfile(SPN, resourceGroupName:string, webAppName: string, slotName: string) {
    var deferred = Q.defer();
    var slotUrl = (slotName == "production") ? "" : "/slots/" + slotName;
    var accessToken = await getAuthorizationToken(SPN);
    
    var url = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/publishxml?' + azureApiVersion;
    var headers = {
        authorization: 'Bearer '+ accessToken

    };

    httpObj.get('POST', url, headers, (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            parseString(body, (error, result) => {
                for (var index in result.publishData.publishProfile) {
                    if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy")
                        deferred.resolve(result.publishData.publishProfile[index].$);
                }
                deferred.reject(tl.loc('ErrorNoSuchDeployingMethodExists', webAppName));
            });
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc('UnabletoretrieveconnectiondetailsforazureRMWebApp0StatusCode1', webAppName, response.statusCode));
        }
    });

    return deferred.promise;
}

export function getAuthorizationToken(SPN): Q.Promise<string> {

    var deferred = Q.defer<string>();
    var authorityUrl = authUrl + SPN.tenantID;

    var context = new AuthenticationContext(authorityUrl);
    context.acquireTokenWithClientCredentials(armUrl, SPN.servicePrincipalClientID, SPN.servicePrincipalKey, (error, tokenResponse) => {
        if(error) {
            deferred.reject(error);
        }
        else {
            deferred.resolve(tokenResponse.accessToken);
        }
    });

    return deferred.promise;
}
