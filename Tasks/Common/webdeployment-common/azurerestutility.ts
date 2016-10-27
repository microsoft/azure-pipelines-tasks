var adal = require ('adal-node');
var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

var kuduDeploymentStatusUtility = require('./kududeploymentstatusutility.js');

var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestClient(httpObj);

var AuthenticationContext = adal.AuthenticationContext;
var authUrl = 'https://login.windows.net/';
var armUrl = 'https://management.azure.com/';
var azureApiVersion = 'api-version=2015-08-01';

/**
 * updates the deployment status in kudu service
 * 
 * @param   publishingProfile     Publish Profile details
 * @param   isDeploymentSuccess   Status of Deployment
 * 
 * @returns promise with string
 */
export function updateDeploymentStatus(publishingProfile, isDeploymentSuccess: boolean): Q.Promise<string>  {
    var deferred = Q.defer<string>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    tl.debug('Web App Publish Kudu URL: ' + webAppPublishKuduUrl);
    if(webAppPublishKuduUrl) {
        var requestDetails = kuduDeploymentStatusUtility.getUpdateHistoryRequest(webAppPublishKuduUrl, isDeploymentSuccess);
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
                    deferred.resolve(tl.loc("Successfullyupdateddeploymenthistory", body.url));
                }
                else {
                    tl.warning(body);
                    deferred.reject(tl.loc("Failedtoupdatedeploymenthistory"));
                }
        });
    }
    else {
        deferred.reject(tl.loc('WARNINGCannotupdatedeploymentstatusSCMendpointisnotenabledforthiswebsite'));
    }

    return deferred.promise;
}

/**
 * Gets the Azure RM Web App Connections details from SPN
 * 
 * @param   SPN                 Service Principal Name
 * @param   webAppName          Name of the web App
 * @param   resourceGroupName   Resource Group Name
 * @param   deployToSlotFlag    Flag to check slot deployment
 * @param   slotName            Name of the slot
 * 
 * @returns (JSON)            
 */
export async function getAzureRMWebAppPublishProfile(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {
    if(!deployToSlotFlag) {
         var requestURL = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resources?$filter=resourceType EQ \'Microsoft.Web/Sites\' AND name EQ \'' + 
                          webAppName + '\'&api-version=2016-07-01';
        var accessToken = await getAuthorizationToken(SPN);
        var headers = {
            authorization: 'Bearer '+ accessToken
        };
        var webAppID = await getAzureRMWebAppID(SPN, webAppName, requestURL, headers);

        tl.debug('Web App details : ' + webAppID.id);
        resourceGroupName = webAppID.id.split ('/')[4];
        tl.debug('AzureRM Resource Group Name : ' + resourceGroupName);
    }
    var deferred = Q.defer();
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var accessToken = await getAuthorizationToken(SPN);
    
    var url = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/publishxml?' + azureApiVersion;
    var headers = {
        authorization: 'Bearer '+ accessToken

    };

    tl.debug('Requesting AzureRM Publish Profile: ' + url);
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
                deferred.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
            });
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc('UnabletoretrieveconnectiondetailsforazureRMWebApp', webAppName, response.statusCode, response.statusMessage));
        }
    });

    return deferred.promise;
}

function getAuthorizationToken(SPN): Q.Promise<string> {

    var deferred = Q.defer<string>();
    var authorityUrl = authUrl + SPN.tenantID;

    var context = new AuthenticationContext(authorityUrl);

    tl.debug('Requesting for Auth Token: ' + authorityUrl);
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

async function getAzureRMWebAppID(SPN, webAppName: string, url: string, headers) {
    var deferred = Q.defer<any>();

    tl.debug('Requesting AzureRM Web App ID: ' + url);
    httpObj.get('GET', url, headers, async (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            var webAppIDDetails = JSON.parse(body);

            if(webAppIDDetails.value.length === 0) {
                if(webAppIDDetails.nextLink) {
                    tl.debug("Requesting nextLink to accesss webappId for webapp " + webAppName);
                    deferred.resolve(await getAzureRMWebAppID(SPN, webAppName, webAppIDDetails.nextLink, headers));
                }
                deferred.reject(tl.loc("WebAppDoesntExist", webAppName));
            }
            deferred.resolve(webAppIDDetails.value[0]);
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc('UnabletoretrieveWebAppID', webAppName, response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}

/**
 *  REST request for azure webapp config details. Config details contains virtual application mappings.
 *  
 *  @param SPN                 Subscription details
 *  @param webAppName          Web application name
 *  @param deployToSlotFlag    Should deploy to slot
 *  @param slotName            Slot for deployment
 */
export async function getAzureRMWebAppConfigDetails(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {

    if(!deployToSlotFlag) {
       var requestURL = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resources?$filter=resourceType EQ \'Microsoft.Web/Sites\' AND name EQ \'' + 
                          webAppName + '\'&api-version=2016-07-01';
        var accessToken = await getAuthorizationToken(SPN);
        var headers = {
            authorization: 'Bearer '+ accessToken
        };
        var webAppID = await getAzureRMWebAppID(SPN, webAppName, requestURL, headers);
        tl.debug('Web App details : ' + webAppID.id);
        resourceGroupName = webAppID.id.split ('/')[4];
        tl.debug('AzureRM Resource Group Name : ' + resourceGroupName);
    }

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(SPN);
    var headers = {
        authorization: 'Bearer '+ accessToken
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = armUrl + 'subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName +
             '/providers/Microsoft.Web/sites/' + webAppName + slotUrl +  '/config/web?' + azureApiVersion;

    tl.debug('Requesting AzureRM Config Details: ' + configUrl);
    httpObj.get('GET', configUrl, headers, (error, response, body) => {
        if( error ) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            var obj = JSON.parse(body);
            deferred.resolve(obj);
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc('UnabletoretrieveAzureRMWebAppConfigDetails', response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}
