import * as tl from "vsts-task-lib/task";
import * as Q from "q";
import * as querystring from "querystring";
import { HttpClient, HttpClientResponse } from "typed-rest-client/HttpClient";
import { RestClient, IRequestOptions, IRestResponse } from "typed-rest-client/RestClient";
import { IRequestOptions as IHttpRequestOptions } from "typed-rest-client/Interfaces";
import * as Utils from "./utility";

var parseString = require('xml2js').parseString;
var uuidV4 = require("uuid/v4");
var kuduDeploymentStatusUtility = require('./kududeploymentstatusutility.js');

let proxyUrl: string = tl.getVariable("agent.proxyurl");
let requestOptions: IHttpRequestOptions = proxyUrl ? {
    proxy: {
        proxyUrl: proxyUrl,
        proxyUsername: tl.getVariable("agent.proxyusername"),
        proxyPassword: tl.getVariable("agent.proxypassword"),
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
    }
} : {};

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";
let httpClient = new HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);
let restClient = new RestClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, null, requestOptions);

var defaultAuthUrl = 'https://login.windows.net/';
var azureApiVersion = 'api-version=2016-08-01';
var azureContainerRegistryApiVersion = "api-version=2017-03-01";
var defaultWebAppAvailabilityTimeoutInMS = 3000;

export const appInsightsInstrumentationKeyAppSetting = "APPINSIGHTS_INSTRUMENTATIONKEY";

export interface IDictionaryStringTo<T> {
    [key: string]: T;
}

/**
 * gets the name of the ResourceGroup that contains the resource
 *
 * @param   endpoint            Service Principal Name
 * @param   resourceName        Name of the resource
*/
export async function getResourceGroupName(endpoint, resourceName: string, resourceType) {
    if (resourceType == null || resourceType == undefined) {
        resourceType = "Microsoft.Web/Sites";
    }

    var requestURL = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resources?$filter=resourceType EQ \'' + resourceType + '\' AND name EQ \'' + resourceName + '\'&api-version=2016-07-01';
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer ' + accessToken
    };
    var resourceID = await getAzureRMResourceID(endpoint, resourceName, requestURL, headers);

    tl.debug('Web App details : ' + resourceID.id);
    var resourceGroupName = resourceID.id.split('/')[4];
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
export function updateDeploymentStatus(publishingProfile, isDeploymentSuccess: boolean, customMessage, deploymentId): Q.Promise<string> {
    var deferred = Q.defer<string>();
    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    tl.debug('Web App Publish Kudu URL: ' + webAppPublishKuduUrl);
    if (webAppPublishKuduUrl) {
        var requestDetails = kuduDeploymentStatusUtility.getUpdateHistoryRequest(webAppPublishKuduUrl, isDeploymentSuccess, customMessage, deploymentId);
        var accessToken = 'Basic ' + (new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64'));
        var headers = {
            authorization: accessToken
        };

        let options: IRequestOptions = {};
        options.additionalHeaders = headers;
        let promise: Promise<IRestResponse<any>> = restClient.replace(requestDetails['requestUrl'], requestDetails['requestBody'], options);
        promise.then((response) => {
            if (response.statusCode === 200) {
                deferred.resolve(tl.loc("Successfullyupdateddeploymenthistory", response.result.url));
            } else {
                tl.debug("Action: updateDeploymentStatus, Response: " + JSON.stringify(response));
                deferred.reject(tl.loc("Failedtoupdatedeploymenthistory"));
            }
        }, (error) => {
            deferred.reject(error);
        });
    }
    else {
        deferred.reject(tl.loc('WARNINGCannotupdatedeploymentstatusSCMendpointisnotenabledforthiswebsite'));
    }

    return deferred.promise;
}

/**
 * Get all continious web jobs 
 * 
 * @param   publishingProfile     Publish Profile details
 * 
 * @returns promise with string
 */
export function getAllContinuousWebJobs(publishingProfile): Q.Promise<any> {
    var deferred = Q.defer<any>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    tl.debug('Web App Publish Kudu URL: ' + webAppPublishKuduUrl);
    if (webAppPublishKuduUrl) {
        var requestUrl = "https://" + webAppPublishKuduUrl + "/api/continuouswebjobs"
        var accessToken = 'Basic ' + (new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64'));
        var headers = {
            authorization: accessToken
        };

        let options: IRequestOptions = {};
        options.additionalHeaders = headers;
        restClient.get(requestUrl, options).then((response) => {
            if (response.statusCode === 200) {
                deferred.resolve(response.result);
            } else {
                tl.debug("Action: getAllContinuousWebJobs, Response: " + JSON.stringify(response));
                deferred.reject(tl.loc("UnableToFetchContinuousWebJobs"));
            }
        }, (error) => {    
            deferred.reject(error);
        });
    }
    else {
        deferred.reject(tl.loc('UnableToFetchContinuousWebJobs'));
    }

    return deferred.promise;
}

export function startContinuousWebJob(publishingProfile, continuousWebJobName): Q.Promise<string> {
    var deferred = Q.defer<string>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    tl.debug('Web App Publish Kudu URL: ' + webAppPublishKuduUrl);
    if (webAppPublishKuduUrl) {
        var requestUrl = "https://" + webAppPublishKuduUrl + "/api/continuouswebjobs/" + continuousWebJobName + "/start"
        var accessToken = 'Basic ' + (new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64'));
        var headers = {
            authorization: accessToken
        };
        let options: IRequestOptions = {};
        options.additionalHeaders = headers;
        restClient.create(requestUrl, null, options).then((response) => {
            if (response.statusCode === 200) {
                deferred.resolve();
            } else {
                tl.debug("Action: startContinuousWebJob, Response: " + JSON.stringify(response));
                deferred.reject(tl.loc("UnableToStartContinuousWebJob", continuousWebJobName));
            }
        }, (error) => {
            deferred.reject(error);
        });
    }
    else {
        deferred.reject(tl.loc('UnableToStartContinuousWebJob', continuousWebJobName));
    }

    return deferred.promise;
}

export function stopContinuousWebJob(publishingProfile, continuousWebJobName): Q.Promise<string> {
    var deferred = Q.defer<string>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    tl.debug('Web App Publish Kudu URL: ' + webAppPublishKuduUrl);
    if (webAppPublishKuduUrl) {
        var requestUrl = "https://" + webAppPublishKuduUrl + "/api/continuouswebjobs/" + continuousWebJobName + "/stop"
        var accessToken = 'Basic ' + (new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64'));
        var headers = {
            authorization: accessToken
        };
        let options: IRequestOptions = {};
        options.additionalHeaders = headers;
        restClient.create(requestUrl, null, options).then((response) => {
            if (response.statusCode === 200) {
                deferred.resolve();
            } else {
                tl.debug("Action: stopContinuousWebJob, Response: " + JSON.stringify(response));
                deferred.reject(tl.loc("UnableToStopContinuousWebJob", continuousWebJobName));
            }
        }, (error) => {
            deferred.reject(error);
        });
    }
    else {
        deferred.reject(tl.loc('UnableToStopContinuousWebJob', continuousWebJobName));
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
        authorization: 'Bearer ' + accessToken
    };

    var deferred = Q.defer();
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";

    var url = endPoint.url + 'subscriptions/' + endPoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/publishxml?' + azureApiVersion;

    tl.debug('Requesting Azure Publish Profile: ' + url);
    httpClient.post(url, null, headers).then(async (response) => {
        let contents: string = "";
        try {
            contents = await response.readBody();
        } catch (error) {
            deferred.reject(tl.loc("UnableToReadResponseBody", error));
        }

        if (response.message.statusCode === 200) {
            parseString(contents, (error, result) => {
                for (var index in result.publishData.publishProfile) {
                    if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy") {
                        deferred.resolve(result.publishData.publishProfile[index].$);
                    }
                }
                deferred.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
            });
        } else {
            tl.debug("Action: getAzureRMWebAppPublishProfile, Response: " + contents);
            tl.error(response.message.statusMessage);
            deferred.reject(tl.loc('UnabletoretrieveconnectiondetailsforazureRMWebApp', webAppName, response.message.statusCode, response.message.statusMessage));
        }
    }, (error) => {
        deferred.reject(error);
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
                tl.debug("Request for Auth token failed with error ETIMEDOUT. Retry Attempt: " + retryCounter);
                if (retryCounter <= 5) {
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
    httpClient.post(authorityUrl, requestData, requestHeader).then(async (response: HttpClientResponse) => {
        if (response.message.statusCode === 200) {
            let contents: string = "";
            try {
                contents = await response.readBody();
            } catch (error) {
                deferred.reject(tl.loc("UnableToReadResponseBody", error));
            }
            if (contents && contents.length > 0) {
                deferred.resolve(JSON.parse(contents).access_token);
            }
        } else {
            deferred.reject(tl.loc('CouldnotfetchaccesstokenforAzureStatusCode', response.message.statusCode, response.message.statusMessage));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

async function getAzureRMResourceID(endpoint, resourceName: string, url: string, headers) {
    var deferred = Q.defer<any>();

    tl.debug('Requesting Azure App Service ID: ' + url);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.get(url, options);
    promise.then(async (response) => {
        if (response.statusCode === 200) {
            let resourceIDDetails: any = response.result;
            if (resourceIDDetails.value.length === 0) {
                if (resourceIDDetails.nextLink) {
                    tl.debug("Requesting nextLink to accesss Id for resource " + resourceName);
                    try {
                        deferred.resolve(await getAzureRMResourceID(endpoint, resourceName, resourceIDDetails.nextLink, headers));
                    } catch (error) {
                        deferred.reject(error);
                    }
                }
                deferred.reject(tl.loc("ResourceDoesntExist", resourceName));
            }
            deferred.resolve(resourceIDDetails.value[0]);
        } else {
            tl.debug("Action: getAzureRMResourceID, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc('UnabletoretrieveWebAppID', resourceName, response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
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
        authorization: 'Bearer ' + accessToken
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/config/web?' + azureApiVersion;

    tl.debug('Requesting Azure App Service web config Details: ' + configUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.get(configUrl, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: getAzureRMWebAppConfigDetails, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc('Unabletoretrievewebconfigdetails', response.statusCode));
        }
    }, (error) => {    
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function updateAzureRMWebAppConfigDetails(endPoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string, configDetails: string) {
    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endPoint);
    var headers = {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endPoint.url + 'subscriptions/' + endPoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/config/web?' + azureApiVersion;

    tl.debug('Updating web config details at: ' + configUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.update(configUrl, JSON.parse(configDetails), options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve();
        } else {
            tl.debug("Action: updateAzureRMWebAppConfigDetails, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("UnableToUpdateWebAppConfigDetails", response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function getWebAppAppSettings(endpoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string/*, appSettings: Object*/) {
    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer ' + accessToken
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/config/appsettings/list?' + azureApiVersion;

    tl.debug('Requesting for the Current List of App Settings: ' + configUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.create(configUrl, null, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: getWebAppAppSettings, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc('Unabletoretrievewebconfigdetails', response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function updateWebAppAppSettings(endpoint, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string, appSettings: Object) {
    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        authorization: 'Bearer ' + accessToken
    };

    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var configUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/config/appsettings?' + azureApiVersion;

    tl.debug('Updating the Current List of App Settings: ' + configUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<IRestResponse<any>> = restClient.replace(configUrl, appSettings, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(appSettings);
        } else {
            tl.debug("Action: updateWebAppAppSettings, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc('Unabletoupdatewebappsettings', response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

async function getOperationStatus(SPN, url: string) {
    var deferred = Q.defer();
    var accessToken = await getAccessToken(SPN);
    var headers = {
        authorization: 'Bearer ' + accessToken
    };

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<IRestResponse<any>> = restClient.get(url, options);
    promise.then((response) => {
        deferred.resolve(response);
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

function monitorSlotSwap(SPN, url) {
    tl.debug("Monitoring slot swap operation status from: " + url);
    var deferred = Q.defer();
    var attempts = 0;
    var poll = async function () {
        if (attempts < 360) {
            attempts++;
            tl.debug("Slot swap operation is in progress. Attempt : " + attempts);
            await getOperationStatus(SPN, url).then((response: IRestResponse<any>) => {
                if (response.statusCode === 200) {
                    deferred.resolve();
                }
                else if (response.statusCode === 202) {
                    setTimeout(poll, 5000);
                }
                else {
                    tl.debug("Slot swap operation failed.StatusCode: " + response.statusCode + ", Response: " + JSON.stringify(response.result));
                    deferred.reject(response.statusCode);
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

export async function swapWebAppSlot(endpoint, resourceGroupName: string, webAppName: string, sourceSlot: string, targetSlot: string, preserveVnet: boolean) {
    var deferred = Q.defer<any>();
    var url = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.Web/sites/' + webAppName + "/slots/" + sourceSlot + '/slotsswap?' + azureApiVersion;

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
    };

    var body = JSON.stringify(
        {
            targetSlot: targetSlot,
            preserveVnet: preserveVnet
        }
    );

    console.log(tl.loc('StartingSwapSlot', webAppName));
    httpClient.post(url, body, headers).then(async (response: HttpClientResponse) => {
        if (response.message.statusCode === 200) {
            deferred.resolve();
        } else if (response.message.statusCode === 202) {
            await monitorSlotSwap(endpoint, response.message.headers.location).then(() => {
                deferred.resolve();
            }).catch((error) => {
                deferred.reject(error);
            });
        } else {
            let contents: string = "";
            try {
                contents = await response.readBody();
            } catch (error) {
                deferred.reject(tl.loc("UnableToReadResponseBody", error));
            }
            tl.debug("Slot swap operation failed. Operation Response: " + contents);
            deferred.reject(response.message.statusMessage);
        }
    }, (error) => {
        deferred.reject(error);
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
        'Authorization': 'Bearer ' + accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to start App Service: ' + url);
    console.log(tl.loc('StartingAppService', webAppNameWithSlot));

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.create(url, null, options);
    promise.then((response) => {
        if (response.statusCode === 200 || response.statusCode === 204) {
            deferred.resolve(tl.loc('AppServicestartedsuccessfully', webAppNameWithSlot));
        } else {
            tl.debug("Action: startAppService, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("FailedtoStartAppService", webAppNameWithSlot, response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
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
        'Authorization': 'Bearer ' + accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to stop App Service: ' + url);
    console.log(tl.loc('StoppingAppService', webAppNameWithSlot));

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.create(url, null, options);
    promise.then((response) => {
        if (response.statusCode === 200 || response.statusCode === 204) {
            deferred.resolve(tl.loc('AppServicestoppedsuccessfully', webAppNameWithSlot));
        } else {
            tl.debug("Action: stopAppService, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("FailedtoStopAppService", webAppNameWithSlot, response.statusCode, response.statusMessage));
        }
    }, (error) => {
        deferred.reject(error);
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
        'Authorization': 'Bearer ' + accessToken
    };
    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to restart App Service: ' + url);
    console.log(tl.loc('RestartingAppService', webAppNameWithSlot));

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.create(url, null, options);
    promise.then((response) => {
        if (response.statusCode === 200 || response.statusCode === 204) {
            deferred.resolve(tl.loc('AppServiceRestartedSuccessfully', webAppNameWithSlot));
        } else if (response.statusCode === 202) {
            tl.warning(tl.loc('RestartAppServiceAccepted'));
            deferred.resolve(tl.loc('RestartAppServiceAccepted', webAppNameWithSlot));
        }
        else {
            tl.debug("Action: restartAppService, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("FailedtoRestartAppService", webAppNameWithSlot, response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function getAzureContainerRegistryCredentials(endpoint, azureContainerRegistry: string, resourceGroupName: string) {
    var deferred = Q.defer<any>();

    var credsUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + resourceGroupName +
        '/providers/Microsoft.ContainerRegistry/registries/' + azureContainerRegistry + '/listCredentials?' + azureContainerRegistryApiVersion;

    tl.debug('Requesting Azure Contianer Registry Creds: ' + credsUrl);

    var accessToken = await getAuthorizationToken(endpoint);
    var headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.create(credsUrl, null, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: getAzureContainerRegistryCredentials, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc('Unabletoretrieveazureregistrycredentials', response.statusCode));

        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function testAzureWebAppAvailability(webAppUrl, availabilityTimeout) {
    var deferred = Q.defer();
    var headers = {};

    let promise: Promise<any> = httpClient.get(webAppUrl, headers);
    promise.then(async (response) => {
        let contents: string = await response.readBody();
        if (response.message.statusCode === 200) {
            tl.debug("Azure web app is available.");
            var webAppAvailabilityTimeout = (availabilityTimeout && !(isNaN(Number(availabilityTimeout)))) ? Number(availabilityTimeout) : defaultWebAppAvailabilityTimeoutInMS;
            setTimeout(() => {
                deferred.resolve("SUCCESS");
            }, webAppAvailabilityTimeout);
        } else {
            tl.debug("Azure web app in wrong state. Action: testAzureWebAppAvailability, Response: " + contents);
            deferred.reject("FAILED");
        }
    }, (error) => {
        tl.debug("Failed to check availability of azure web app, error : " + error);
        deferred.reject(error);
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
        'Authorization': 'Bearer ' + accessToken
    };

    var webAppNameWithSlot = (specifySlotFlag) ? webAppName + '-' + slotName : webAppName;
    tl.debug('Request to get App State: ' + webAppNameWithSlot);

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.get(url, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: getAppServiceDetails, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("FailedToFetchAppServiceState", webAppNameWithSlot, response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
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
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.create(metadataUrl, null, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: getAzureRMWebAppMetadata, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("UnableToGetAzureRMWebAppMetadata", response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
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

    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = restClient.replace(metadataUrl, webAppMetadata, options);
    promise.then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve();
        } else {
            tl.debug("Action: updateAzureRMWebAppMetadata, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc("UnableToUpdateAzureRMWebAppMetadata", response.statusCode));
        }
    }, (error) => {
        deferred.reject(error);
    });
    return deferred.promise;
}

export async function getApplicationInsightsResources(endpoint, appInsightsResourceGroupName, filter: string) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);

    var headers = {
        "Content-Type": "application/json",
        authorization: 'Bearer ' + accessToken
    };

    var resourceGroupPath = (appInsightsResourceGroupName) ? "/resourceGroups/" + appInsightsResourceGroupName : "";
    var resultFilter = !!filter ? `$filter=${filter}&` : "";

    var metadataUrl = `${endpoint.url}subscriptions/${endpoint.subscriptionId}${resourceGroupPath}/providers/microsoft.insights/components?${resultFilter}api-version=2015-05-01`;

    tl.debug('Requesting Application insights resources : ' + metadataUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    restClient.get(metadataUrl, options).then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result['value']);
        } else {
            tl.debug("Action: getApplicationInsightsResources, Response: " + JSON.stringify(response));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function updateApplicationInsightsResource(endpoint, appInsightsResourceGroupName, appInsightsResourceData) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);

    var headers = {
        "Content-Type": "application/json",
        authorization: 'Bearer ' + accessToken
    };

    var metadataUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + appInsightsResourceGroupName +
        '/providers/microsoft.insights/components/' + appInsightsResourceData.name + '?api-version=2015-05-01';

    tl.debug('Updating Application insights resources : ' + metadataUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    restClient.replace(metadataUrl, appInsightsResourceData, options).then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: updateApplicationInsightsResource, Response: " + JSON.stringify(response));
            deferred.reject(new Error(response.statusCode.toString()));
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

function sleep(timeInMilliSecond) {
    return new Promise(resolve => setTimeout(resolve, timeInMilliSecond));
}

export async function getAppInsightsWebTests(endpoint, appInsightsResourceGroupName) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);

    var headers = {
        "Content-Type": "application/json",
        authorization: 'Bearer ' + accessToken
    };

    var resourceGroupPath = (appInsightsResourceGroupName) ? "/resourceGroups/" + appInsightsResourceGroupName : "";

    var metadataUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + resourceGroupPath +
        '/providers/microsoft.insights/webTests?api-version=2015-05-01';

    tl.debug('Requesting App Insights web tests : ' + metadataUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    restClient.get(metadataUrl, options).then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result['value']);
        } else {
            tl.debug("Action: getAppInsightsWebTests, Response: " + JSON.stringify(response));
            deferred.reject(response.statusCode);
        }
    }, (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

export async function createAppInsightsWebTest(endpoint, appInsightsResourceGroupName, webTestName, appInsightsResourceData, appServiceUrl) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(endpoint);

    var headers = {
        "Content-Type": "application/json",
        authorization: 'Bearer ' + accessToken
    };

    var webTestHiddenLink = "hidden-link:" + appInsightsResourceData.id;
    webTestName = "webtest" + webTestName;
    appServiceUrl = ((appServiceUrl.indexOf("http") != -1) ? "" : "http://") + appServiceUrl;

    var webTestData = {
        "name": webTestName,
        "location": appInsightsResourceData.location,
        "tags": {},
        "properties": {
            "SyntheticMonitorId": webTestName,
            "Name": webTestName,
            "Description": "",
            "Enabled": true,
            "Frequency": 300,
            "Timeout": 120,
            "Kind": "ping",
            "RetryEnabled": true,
            "Locations": [
                {
                    "Id": "us-tx-sn1-azr"
                },
                {
                    "Id": "us-il-ch1-azr"
                },
                {
                    "Id": "us-ca-sjc-azr"
                },
                {
                    "Id": "us-va-ash-azr"
                },
                {
                    "Id": "us-fl-mia-edge"
                }
            ],
            "Configuration": {
                "WebTest": "<WebTest Name=\"" + webTestName + "\" Enabled=\"True\" CssProjectStructure=\"\"  CssIteration=\"\"  Timeout=\"120\"  WorkItemIds=\"\"  xmlns=\"http://microsoft.com/schemas/VisualStudio/TeamTest/2010\" Description=\"\" CredentialUserName=\"\" CredentialPassword=\"\" PreAuthenticate=\"True\" Proxy=\"default\" StopOnError=\"False\" RecordedResultFile=\"\" ResultsLocale=\"\"> <Items> <Request Method=\"GET\"  Version=\"1.1\"  Url=\"" + appServiceUrl + "\"  ThinkTime=\"0\" Timeout=\"120\" ParseDependentRequests=\"True\" FollowRedirects=\"True\"         RecordResult=\"True\"         Cache=\"False\" ResponseTimeGoal=\"0\" Encoding=\"utf-8\"  ExpectedHttpStatusCode=\"200\" ExpectedResponseUrl=\"\"  ReportingName=\"\" IgnoreHttpStatusCode=\"False\" /></Items></WebTest>"
            }
        }
    }

    webTestData.tags[webTestHiddenLink] = "Resource";

    var metadataUrl = endpoint.url + 'subscriptions/' + endpoint.subscriptionId + '/resourceGroups/' + appInsightsResourceGroupName +
        '/providers/microsoft.insights/webTests/' + webTestName + '?api-version=2015-05-01';

    tl.debug('Updating Application insights resources : ' + metadataUrl);
    let options: IRequestOptions = {};
    options.additionalHeaders = headers;
    restClient.replace(metadataUrl, webTestData, options).then((response) => {
        if (response.statusCode === 200) {
            deferred.resolve(response.result);
        } else {
            tl.debug("Action: createAppInsightsWebTest, Response: " + JSON.stringify(response));
            deferred.reject(response.statusCode);
        }
    },
    (error) => {
        deferred.reject(error);
    });

    return deferred.promise;
}

/**
 * Adds release annotation to an application insights resource
 * 
 * @param   endpoint                Service Principal Endpoint
 * @param   appInsightsResourceId   ResourceId of the application insights resource
 * @param   isDeploymentSuccess     Add annotation for success or failed deployment
 */
export async function addReleaseAnnotation(endpoint, appInsightsResourceId: string, isDeploymentSuccess: string): Promise<any> {
    let deferred: Q.Deferred<any> = Q.defer<any>();

    let accessToken = await getAuthorizationToken(endpoint);
    let restOptions: IRequestOptions = {
        additionalHeaders: {
            "Authorization": `Bearer ${accessToken}`
        }
    };

    let restUrl = `${endpoint.url}${appInsightsResourceId}/Annotations?api-version=2015-05-01`;
    let releaseAnnotationProperties: IDictionaryStringTo<string> = {
        "Label": isDeploymentSuccess ? "Success" : "Error", // Label decides the icon for release annotation
        "Deployment Uri": Utils.getDeploymentUri()
    };

    let annotationName = "Release Annotation";
    let releaseUri = tl.getVariable("Release.ReleaseUri");
    let buildUri = tl.getVariable("Build.BuildUri");

    if (!!releaseUri) {
        annotationName = `${tl.getVariable("Release.DefinitionName")} - ${tl.getVariable("Release.ReleaseName")}`;
    }
    else if (!!buildUri) {
        annotationName = `${tl.getVariable("Build.DefinitionName")} - ${tl.getVariable("Build.BuildNumber")}`;
    }
 
    let releaseAnnotation = {
        "AnnotationName": annotationName,
        "Category": "Text",
        "EventTime": new Date(),
        "Id": uuidV4(),
        "Properties": JSON.stringify(releaseAnnotationProperties)
    };

    tl.debug(`Adding release annotation. Requesting: ${restUrl} \n${JSON.stringify(releaseAnnotation, null, 2)}`);

    restClient.replace(restUrl, releaseAnnotation, restOptions)
        .then((response) => {
            if (response.statusCode === 200) {
                deferred.resolve(response.result);
            } 
            else {
                deferred.reject(JSON.stringify(response, null, 2));
            }
        }, (error) => {
            deferred.reject(error);
        });

    return deferred.promise;
}