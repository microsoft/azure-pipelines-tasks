var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

var kuduDeploymentStatusUtility = require('./kududeploymentstatusutility.js');

import * as Util from "./utility";
import { 
    IAzureRestUtilityResponse,
    IAzureMetricAlertRequestBody,
    IAzureMetricAlertRule
} from './Interfaces';

var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new restClient.RestCallbackClient(httpObj);

var defaultAuthUrl = 'https://login.windows.net/';
var azureApiVersion = 'api-version=2016-08-01';
var defaultWebAppAvailabilityTimeoutInMS = 3000;

/**
 * gets the name of the ResourceGroup that contains the webApp
 *
 * @param   endpoint            Service Principal Name
 * @param   webAppName          Name of the web App
*/
export async function getResourceGroupName(endpoint, webAppName: string)
{
    var requestURL = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resources?$filter=resourceType EQ \'Microsoft.Web/Sites\' AND name EQ \'' + webAppName + '\'&api-version=2016-07-01';
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer '+ accessToken
    };
    var webAppID = await getAzureRMWebAppID(endpoint, webAppName, requestURL, headers);

    tl.debug('Web App details : ' + webAppID.id);
    var resourceGroupName = webAppID.id.split ('/')[4];
    tl.debug('Azure Resource Group Name : ' + resourceGroupName);
    return resourceGroupName;
}
/**
 * updates the deployment status in kudu service
 * 
 * @param   publishingProfile     Publish Profile details
 * @param   isDeploymentSuccess   Status of Deployment
 * 
 * @returns promise with string
 */
export function updateDeploymentStatus(publishingProfile, isDeploymentSuccess: boolean, customMessage, deploymentId): Q.Promise<string>  {
    var deferred = Q.defer<string>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    tl.debug('Web App Publish Kudu URL: ' + webAppPublishKuduUrl);
    if(webAppPublishKuduUrl) {
        var requestDetails = kuduDeploymentStatusUtility.getUpdateHistoryRequest(webAppPublishKuduUrl, isDeploymentSuccess, customMessage, deploymentId);
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
 * Gets the Azure RM Web App Connections details from endpoint
 * 
 * @param   endpoint            Service Principal Name
 * @param   webAppName          Name of the web App
 * @param   resourceGroupName   Resource Group Name
 * @param   deployToSlotFlag    Flag to check slot deployment
 * @param   slotName            Name of the slot
 * 
 * @returns (JSON)
 */
export async function getAzureRMWebAppPublishProfile(endPoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {

    var accessToken = await getAuthorizationToken(endPoint);
    var headers = {
        authorization: 'Bearer '+ accessToken
    };

    var deferred = Q.defer();
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";

    var url = endPoint.url + 'subscriptions/' + endPoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/publishxml?' + azureApiVersion;

    tl.debug('Requesting Azure Publish Profile: ' + url);
    httpObj.send('POST', url, null, headers, (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            parseString(body, (error, result) => {
                for (var index in result.publishData.publishProfile) {
                    if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy") {
                        deferred.resolve(result.publishData.publishProfile[index].$);
                    }
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

function getAccessToken(endPoint) {
    var deferred = Q.defer<string>();
    var retryCounter = 0;

    var getAccessTokenInternal = async function () {
        retryCounter++;
        await getAuthorizationToken(endPoint).then((value) => {
            return deferred.resolve(value);
        }, (error) => {
            if (error.code == "ETIMEDOUT") {
                tl.debug("Request for Auth token failed with error ETIMEDOUT. Retry Attempt: "+ retryCounter);
                if(retryCounter <= 5) {
                    setTimeout(getAccessTokenInternal, 5000);
                }
                else {
                    deferred.reject(error);
                }
            }
            else {
                deferred.reject(error);
            }
        });
    }
    getAccessTokenInternal();
    return deferred.promise;
}

function getAuthorizationToken(endPoint): Q.Promise<string> {

    var deferred = Q.defer<string>();
    var envAuthUrl = (endPoint.envAuthUrl) ? (endPoint.envAuthUrl) : defaultAuthUrl;
    var authorityUrl = envAuthUrl + endPoint.tenantID + "/oauth2/token/";
    var requestData = querystring.stringify({
        resource: endPoint.activeDirectoryResourceId,
        client_id: endPoint.servicePrincipalClientID,
        grant_type: "client_credentials",
        client_secret: endPoint.servicePrincipalKey
    });
    var requestHeader = {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
    }

    tl.debug('Requesting for Auth Token: ' + authorityUrl);
    httpObj.send('POST', authorityUrl, requestData, requestHeader, (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if (response.statusCode == 200) {
            deferred.resolve(JSON.parse(body).access_token);
        }
        else {
            deferred.reject(tl.loc('CouldnotfetchaccesstokenforAzureStatusCode', response.statusCode, response.statusMessage));
        }
    });

    return deferred.promise;
}

async function getAzureRMWebAppID(endpoint, webAppName: string, url: string, headers) {
    var deferred = Q.defer<any>();

    tl.debug('Requesting Azure App Service ID: ' + url);
    httpObj.get('GET', url, headers, async (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            var webAppIDDetails = JSON.parse(body);

            if(webAppIDDetails.value.length === 0) {
                if(webAppIDDetails.nextLink) {
                    tl.debug("Requesting nextLink to accesss webappId for webapp " + webAppName);
                    try {
                        deferred.resolve(await getAzureRMWebAppID(endpoint, webAppName, webAppIDDetails.nextLink, headers));
                    }
                    catch(error) {
                        deferred.reject(error);
                    }
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
 *  @param endpoint            Subscription details
 *  @param webAppName          Web application name
 *  @param deployToSlotFlag    Should deploy to slot
 *  @param slotName            Slot for deployment
 */
export async function getAzureRMWebAppConfigDetails(endpoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer '+ accessToken
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
             '/providers/Microsoft.Web/sites/' + webAppName + slotUrl +  '/config/web?' + azureApiVersion;

    tl.debug('Requesting Azure App Service web config Details: ' + configUrl);
    httpObj.get('GET', configUrl, headers, (error, response, body) => {
        if( error ) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            var obj = JSON.parse(body);
            deferred.resolve(obj);
        }
        else {
            tl.debug(body);
            deferred.reject(tl.loc('Unabletoretrievewebconfigdetails', response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}

export async function updateAzureRMWebAppConfigDetails(endPoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string, configDetails: string) {

    var deferred = Q.defer<any>();
	var accessToken = await getAuthorizationToken(endPoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken,
        'Content-Type': 'application/json'
    };
	
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endPoint.url + 'subscriptions/' + endPoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
             '/providers/Microsoft.Web/sites/' + webAppName + slotUrl +  '/config/web?' + azureApiVersion;
	
    tl.debug('Updating web config details at: ' + configUrl);
	
    httpObj.send('PATCH', configUrl, configDetails, headers, (error, response, body) =>{
		if(error){
			deferred.reject(error);
		}
		else if(response.statusCode === 200) {
			deferred.resolve();
		}
		else {
			deferred.reject(response.statusMessage);
		}
	});
							
    return deferred.promise;
}

export async function getWebAppAppSettings(endpoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string/*, appSettings: Object*/)
{
    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer '+ accessToken
    };
	
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
             '/providers/Microsoft.Web/sites/' + webAppName + slotUrl +  '/config/appsettings/list?' + azureApiVersion;
	
	tl.debug('Requesting for the Current List of App Settings: ' + configUrl);

	httpObj.send('POST', configUrl, null, headers, (error, response, body) =>{
		if(error){
			deferred.reject(error);
		}
		else if(response.statusCode === 200) {
			deferred.resolve(JSON.parse(body));
		}
		else {
			tl.debug(body);
			deferred.reject(tl.loc('Unabletoretrievewebconfigdetails', response.statusCode, response.statusMessage));
		}
	})
	
	return deferred.promise;
}

export async function updateWebAppAppSettings(endpoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string, appSettings: Object) {

    var deferred = Q.defer<any>();
	var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer '+ accessToken
    };
	
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
             '/providers/Microsoft.Web/sites/' + webAppName + slotUrl +  '/config/appsettings?' + azureApiVersion;
	
    tl.debug('Updating the Current List of App Settings: ' + configUrl);
	
    restObj._sendJson('PUT', configUrl, "", appSettings, headers, null, (error, response, body) =>{
        if(error){
            deferred.reject(error);
        }
        else if(response === 200){
            deferred.resolve(appSettings);
        }
        else {
            tl.debug(body);
            deferred.reject(tl.loc('Unabletoupdatewebappsettings', response, error));
        }
    });
							
    return deferred.promise;
}

async function getOperationStatus(SPN, url: string) {
    var deferred = Q.defer();
    var accessToken = await getAccessToken(SPN);
    var headers = {
        authorization: 'Bearer ' + accessToken
    };
    httpObj.get('GET', url, headers, (error, response, body) => {
        if (error) {
            deferred.reject(error);
        }
        else {
            deferred.resolve({ "response": response, "content": body } );
        }
    });
    return deferred.promise;
}

function monitorSlotSwap(SPN, url) {
    tl.debug("Monitoring slot swap operation status from: "+ url);
    var deferred = Q.defer();
    var attempts = 0;
    var poll = async function() {
        if (attempts < 360) {
            attempts++;
            tl.debug("Slot swap operation is in progress. Attempt : "+ attempts);
            await  getOperationStatus(SPN, url).then((status) => {
                var response = status["response"];
                if (response['statusCode'] === 200) {
                    deferred.resolve();
                }
                else if(response['statusCode'] === 202) {
                    setTimeout(poll, 5000);
                }
                else {
                    tl.debug ("Slot swap operation failed. Operation Response: " + status["content"]);
                    deferred.reject(response['statusMessage']);
                }
            }).catch((error) => {
                deferred.reject(error);
            });
        }
        else {
            deferred.reject("");
        }
    }
    poll();
    return deferred.promise;
}

export async function swapWebAppSlot(endpoint, resourceGroupName: string, webAppName: string, sourceSlot: string, targetSlot: string,preserveVnet: boolean) {
    
    var deferred = Q.defer<any>();
    var url = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + "/slots/" + sourceSlot + '/slotsswap?' + azureApiVersion;

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken,
        'Content-Type': 'application/json'
    };

    var body = JSON.stringify(
        {
            targetSlot: targetSlot,
            preserveVnet: preserveVnet
        }
    );

    console.log(tl.loc('StartingSwapSlot',webAppName));
    httpObj.send('POST', url, body, headers, async (error, response, contents) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            deferred.resolve();
        }
        else if(response.statusCode === 202) {
            await monitorSlotSwap(endpoint, response.headers.location).then(() => {
                deferred.resolve();
            }).catch((error) => {
                deferred.reject(error);
            });
        }
        else {
            tl.debug ("Slot swap operation failed. Operation Response: " + contents);
            deferred.reject(response.statusMessage);
        }
    });
    return deferred.promise;
}

export async function startAppService(endpoint, resourceGroupName: string, webAppName: string, specifySlotFlag: boolean, slotName: string) {
    
    var deferred = Q.defer<any>();
    var slotUrl = (specifySlotFlag) ? "/slots/" + slotName : "";
    var url = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
                '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + "/start?" + azureApiVersion;

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to start App Service: ' + url);
    console.log(tl.loc('StartingAppService', webAppNameWithSlot));
    httpObj.send('POST', url, null, headers, (error, response, body) => {
        if(error) {
            console.log(body);
            deferred.reject(error);
        }
        if(response.statusCode === 200 || response.statusCode === 204) {
            deferred.resolve(tl.loc('AppServicestartedsuccessfully', webAppNameWithSlot));
        }
        else {
            console.log(body);
            deferred.reject(tl.loc("FailedtoStartAppService", webAppNameWithSlot, response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}

export async function stopAppService(endpoint, resourceGroupName: string, webAppName: string, specifySlotFlag: boolean, slotName: string) {
    
    var deferred = Q.defer<any>();
    var slotUrl = (specifySlotFlag) ? "/slots/" + slotName : "";
    var url = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
                '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + "/stop?" + azureApiVersion;

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to stop App Service: ' + url);
    console.log(tl.loc('StoppingAppService', webAppNameWithSlot));
    httpObj.send('POST', url, null, headers, (error, response, body) => {
        if(error) {
            console.log(body);
            deferred.reject(error);
        }
        if(response.statusCode === 200 || response.statusCode === 204) {
            deferred.resolve(tl.loc('AppServicestoppedsuccessfully', webAppNameWithSlot));
        }
        else {
            console.log(body);
            deferred.reject(tl.loc("FailedtoStopAppService",webAppNameWithSlot, response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}

export async function restartAppService(endpoint, resourceGroupName: string, webAppName: string, specifySlotFlag: boolean, slotName: string) {
    
    var deferred = Q.defer<any>();
    var slotUrl = (specifySlotFlag) ? "/slots/" + slotName : "";
    var url = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
                '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + "/restart?" + azureApiVersion + '&synchronous=true';

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to restart App Service: ' + url);
    console.log(tl.loc('RestartingAppService', webAppNameWithSlot));
    httpObj.send('POST', url, null, headers, (error, response, body) => {
        if(error) {
            console.log(body);
            deferred.reject(error);
        }
        if(response.statusCode === 200 || response.statusCode === 204) {
            deferred.resolve(tl.loc('AppServiceRestartedSuccessfully', webAppNameWithSlot));
        }
        else if(response.statusCode === 202) {
            tl.warning(tl.loc('RestartAppServiceAccepted'));
            deferred.resolve(tl.loc('RestartAppServiceAccepted', webAppNameWithSlot));
        }
        else {
            console.log(body);
            deferred.reject(tl.loc("FailedtoRestartAppService",webAppNameWithSlot, response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}

export async function getAzureContainerRegistryCredentials(endpoint, azureContainerRegistry: string) {
    var deferred = Q.defer<any>();

    var url = endpoint.url + azureContainerRegistry + '/listCredentials?api-version=2017-03-01';
    tl.debug('Requesting Azure Contianer Registry Creds: ' + url);

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken
    };

    httpObj.get('POST', url, headers, async (error, response, body) => {
        if(error) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            try {
                var credentials = JSON.parse(body);
                deferred.resolve(credentials);
            }
            catch (error) {
                deferred.reject(error);
            }
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject("Unable to resolve creds for the registry");
        }
    });

    return deferred.promise;
}

export async function testAzureWebAppAvailability(webAppUrl, availabilityTimeout) {
    var deferred = Q.defer();
    var headers = {};
    httpObj.get('GET', webAppUrl, headers, async (error, response, body) => {
        if (error) {
            tl.debug("Failed to check availability of azure web app, error : " + error);
            deferred.reject(error);
        } else {
            if(response.statusCode === 200) {
                tl.debug("Azure web app is available.");
                var webAppAvailabilityTimeout = (availabilityTimeout && !(isNaN(Number(availabilityTimeout)))) ? Number(availabilityTimeout): defaultWebAppAvailabilityTimeoutInMS; 
                await sleep(webAppAvailabilityTimeout);
                deferred.resolve("SUCCESS");
            } else {
                tl.debug("Azure web app in wrong state, status code : " + response.statusCode);
                deferred.reject("FAILED");
            }
        }
    });
    return deferred.promise;
}

export async function getAppServiceDetails(endpoint, resourceGroupName: string, webAppName: string, specifySlotFlag: boolean, slotName: string) {
    
    var deferred = Q.defer<any>();
    var slotUrl = (specifySlotFlag) ? "/slots/" + slotName : "";
    var url = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
                '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + "?" + azureApiVersion;

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer '+ accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to get App State: ' + webAppNameWithSlot);
    httpObj.send('GET', url, null, headers, (error, response, body) => {
        if(error) {
            console.log(body);
            deferred.reject(error);
        }
        if(response.statusCode === 200) {
            deferred.resolve(JSON.parse(body));
        }
        else {
            console.log(body);
            deferred.reject(tl.loc("FailedToFetchAppServiceState", webAppNameWithSlot, response.statusCode, response.statusMessage));
        }
    });
    return deferred.promise;
}

export async function getAzureRMWebAppMetadata(
    endpoint,
    webAppName: string,
    resourceGroupName: string,
    deployToSlotFlag: boolean,
    slotName: string) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer ' + accessToken
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var metadataUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/config/metadata/list?' + azureApiVersion;

    tl.debug('Requesting Azure App Service Metadata: ' + metadataUrl);
    httpObj.get('POST', metadataUrl, headers, (error, response, body) => {
        if (error) {
            deferred.reject(error);
        }
        else if (response.statusCode === 200) {
            var obj = JSON.parse(body);
            deferred.resolve(obj);
        }
        else {
            tl.debug(body);
            deferred.reject(response.statusMessage);
        }
    });
    return deferred.promise;
}

export async function updateAzureRMWebAppMetadata(
    endPoint,
    webAppName: string,
    resourceGroupName: string,
    deployToSlotFlag: boolean,
    slotName: string,
    webAppMetadata: Object) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endPoint);
    var headers = {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var metadataUrl = endPoint.url + 'subscriptions/' + endPoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/config/metadata?' + azureApiVersion;

    tl.debug('Updating Azure App Service Metadata at: ' + metadataUrl);

    restObj._sendJson('PUT', metadataUrl, "", webAppMetadata, headers, null, (error, response, body) => {
        if (error) {
            deferred.reject(error);
        }
        else if (response === 200) {
            deferred.resolve();
        }
        else {
            tl.debug(body);
            deferred.reject(response);
        }
    });
    return deferred.promise;
}

function sleep(timeInMilliSecond) {
  return new Promise(resolve => setTimeout(resolve,timeInMilliSecond));
}

export async function getAzureRmResourceDetails(
    endpoint, 
    resourceUri: string) : Promise<IAzureRestUtilityResponse> {
    
    let deferred: Q.Deferred<IAzureRestUtilityResponse> = Q.defer<IAzureRestUtilityResponse>();
    let accessToken: string = await getAuthorizationToken(endpoint);
    let requestHeader = {
        'Authorization': 'Bearer ' + accessToken
    };

    // resourceUri is of the form : /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/{resourceProviderNamespace}/{resourceType}/{resourceName}

    let splittedResourceUri: string[] = resourceUri.split("/");
    let resourceGroupName: string = splittedResourceUri[4];
    let resourceType: string = splittedResourceUri[6] + "/" +  splittedResourceUri[7];
    let resourceName: string = splittedResourceUri[8];

    tl.debug(`Getting AzureRm resource details - '${resourceName}' in resource group '${resourceGroupName}'`);

    let apiVersion = "2017-05-10";
    let restUrl = `${endpoint.url}subscriptions/${endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/resources?$filter=resourceType EQ '${resourceType}' AND name EQ '${resourceName}'&api-version=${apiVersion}`;

    httpObj.get("GET", restUrl, requestHeader, (error, response, body) => {
        if(error){
            deferred.reject({
                error: error
            });
        }
        else if(response.statusCode === 200) {
            deferred.resolve({
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: JSON.parse(body).value[0]
            });
        }
        else {
            deferred.reject({
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: JSON.parse(body)
            });
        }
    });

    return deferred.promise;
}

export async function getAzureRmAlertRule(
    endpoint, 
    resourceGroupName: string, 
    alertRuleName: string) : Promise<IAzureRestUtilityResponse> {

    let deferred: Q.Deferred<IAzureRestUtilityResponse> = Q.defer<IAzureRestUtilityResponse>();
    let accessToken: string = await getAuthorizationToken(endpoint);
    let requestHeader = {
        'Authorization': 'Bearer ' + accessToken
    };

    tl.debug(`Getting AzureRm alert rule - '${alertRuleName}' in resource group '${resourceGroupName}'`);

    let apiVersion: string = "2016-03-01";
    let restUrl: string = `${endpoint.url}subscriptions/${endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.insights/alertrules/${alertRuleName}?api-version=${apiVersion}`;

    httpObj.get("GET", restUrl, requestHeader, (error, response, body) => {
        if(error){
            deferred.reject({
                error: error
            });
        }
        else if(response.statusCode === 200) {
            deferred.resolve({
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: JSON.parse(body)
            });
        }
        else {
            deferred.reject({
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: JSON.parse(body)
            });
        }
    });

    return deferred.promise;
}

async function getRequestBodyForAddingAlertRule(
    endpoint, 
    resourceGroupName: string, 
    resourceUri: string, 
    rule: IAzureMetricAlertRule, 
    notifyServiceOwners: boolean, 
    notifyEmails: string) : Promise<any> {

    let existingAlertRule: any;
    let notifyViaEmails: boolean = notifyServiceOwners || !!notifyEmails;

    try {
        console.log(tl.loc("AlertRuleCheck", rule.alertName, resourceGroupName));
       
        let getMetricAlertRuleResponse: IAzureRestUtilityResponse = await getAzureRmAlertRule(endpoint, resourceGroupName, rule.alertName);
        existingAlertRule = getMetricAlertRuleResponse.responseBody;

        let existingAlertRuleTargetResourceUri: string = existingAlertRule["properties"].condition.dataSource.resourceUri;
        if(existingAlertRuleTargetResourceUri && existingAlertRuleTargetResourceUri.toLowerCase() !== resourceUri.toLowerCase()) {
            return Q.reject(tl.loc("AlertRuleTargetResourceIdMismatchError", rule.alertName, existingAlertRuleTargetResourceUri));
        }

        console.log(tl.loc("AlertRuleExists", rule.alertName, resourceGroupName));
    }
    catch (error) {
        if(error.statusCode === 404) {
            console.log(tl.loc("AlertRuleDoesNotExist", rule.alertName, resourceGroupName));
        }
    }

    let alertRuleResourceLocation: string = "";
    let alertRuleResourceTags: {[key: string]: string} = {};
    let alertRuleActions = [];

    if(existingAlertRule) {
        // if the alert rule already exists use the location, tags and actions of the existing alert rule
        alertRuleResourceLocation = existingAlertRule.location;
        alertRuleResourceTags = existingAlertRule.tags || {};
        alertRuleActions = existingAlertRule["properties"].actions || [];

        if(notifyViaEmails) {
            alertRuleActions = alertRuleActions.filter((action) => {
                // remove email action which will be updated later
                if(action["odata.type"]) {
                    return action["odata.type"].toLowerCase() !== "Microsoft.Azure.Management.Insights.Models.RuleEmailAction".toLowerCase();
                }
                return true;
            });
        }        
    }
    else {
        // For new alert rules, create the alert rule in the same location as the target resource
        let resourceMetadataResponse = await getAzureRmResourceDetails(endpoint, resourceUri);
        alertRuleResourceLocation = resourceMetadataResponse.responseBody.location;
    }

    // Add the hidden link resource tag 
    alertRuleResourceTags["hidden-link:" + resourceUri] = "Resource";
    
    // Add email action
    if(notifyViaEmails) {
        let notifyEmailsList: string[] = !!notifyEmails ? notifyEmails.split(";") : []; // BUG server throws 400 error, check with team 
        alertRuleActions.push({ 
            "odata.type": "Microsoft.Azure.Management.Insights.Models.RuleEmailAction",
            "sendToServiceOwners": notifyServiceOwners, 
            "customEmails": notifyEmailsList 
        });
    }

    return {
        location: alertRuleResourceLocation,
        tags: alertRuleResourceTags,
        properties: {
            name: rule.alertName,
            description: `Updated via ${Util.getJobIdName()}`, 
            isEnabled: true,
            condition: {
                "odata.type": "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition",
                "dataSource": {
                    "odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
                    "resourceUri": resourceUri,
                    "metricName": rule.metric,
                    "operator": rule.thresholdCondition
                },
                "threshold": rule.thresholdValue,
                "windowSize": getWindowSizeForMetricAlertRule(rule.timePeriod)
            },
            actions: alertRuleActions 
        }
    } as IAzureMetricAlertRequestBody;
}

export async function addOrUpdateAzureMetricAlertRule(
    endpoint, 
    resourceGroupName: string, 
    resourceUri: string, 
    rule: IAzureMetricAlertRule, 
    notifyServiceOwners: boolean, 
    notifyEmails: string) : Promise<IAzureRestUtilityResponse> {
   
    let deferred: Q.Deferred<IAzureRestUtilityResponse> = Q.defer<IAzureRestUtilityResponse>();
    let accessToken: string = await getAuthorizationToken(endpoint);
    let requestHeader = {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
    };

    let requestBody: IAzureMetricAlertRequestBody = await getRequestBodyForAddingAlertRule(endpoint, resourceGroupName, resourceUri, rule, notifyServiceOwners, notifyEmails);
    tl.debug(`Sending PUT request with request body \n${JSON.stringify(requestBody, null, 2)}`); 

    let apiVersion = "2016-03-01";
    let restUrl = `${endpoint.url}subscriptions/${endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.insights/alertrules/${rule.alertName}?api-version=${apiVersion}`;

    httpObj.send("PUT", restUrl, JSON.stringify(requestBody), requestHeader, (error, response, body) => {
        if(error) {
             deferred.reject({
                error: error
            });
        }
        else if(response.statusCode === 200 || response.statusCode === 201) {
            deferred.resolve({
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: JSON.parse(body)
            });
        }
        else {
            deferred.reject({
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: JSON.parse(body)
            });
        }
    });

    return deferred.promise;
}

function getWindowSizeForMetricAlertRule(key: string): string {
    let timePeriodMap: {[key: string]: string} = {
        "Over the last 5 minutes": "PT5M", 
        "Over the last 10 minutes": "PT10M",
        "Over the last 15 minutes": "PT15M",
        "Over the last 30 minutes": "PT30M", 
        "Over the last 45 minutes": "PT45M",
        "Over the last hour": "PT1H", 
        "Over the last 2 hours": "PT2H", 
        "Over the last 3 hours": "PT3H",
        "Over the last 4 hours": "PT4H",
        "Over the last 5 hours": "PT5H",
        "Over the last 6 hours": "PT6H",
        "Over the last 24 hours": "P1D" 
    };

    return timePeriodMap[key] || "";
}