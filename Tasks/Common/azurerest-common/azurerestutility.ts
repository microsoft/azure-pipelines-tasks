var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');
import querystring = require('querystring');
import httpClient = require('vso-node-api/HttpClient');
import restClient = require('vso-node-api/RestClient');

var kuduDeploymentStatusUtility = require('./kududeploymentstatusutility.js');

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

function getAuthorizationToken(endPoint): Q.Promise<string> {

    var deferred = Q.defer<string>();
    var envAuthUrl = (endPoint.envAuthUrl) ? (endPoint.envAuthUrl) : defaultAuthUrl;
    var authorityUrl = envAuthUrl + endPoint.tenantID + "/oauth2/token/";
    var requestData = querystring.stringify({
        resource: endPoint.url,
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
            deferred.reject(tl.loc('CouldnotfetchacccesstokenforAzureStatusCode', response.statusCode, response.statusMessage));
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

    tl.debug('Requesting Azure App Service Config Details: ' + configUrl);
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
	
    tl.debug('Updating config details at: ' + configUrl);
	
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
    var accessToken = await getAuthorizationToken(SPN);
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

function sleep(timeInMilliSecond) {
  return new Promise(resolve => setTimeout(resolve,timeInMilliSecond));
}
