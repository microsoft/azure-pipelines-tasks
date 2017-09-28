import * as tl from "vsts-task-lib/task";
import * as Q from "q";
import * as querystring from "querystring";

import { 
    HttpClient, 
    HttpClientResponse 
} from "typed-rest-client/HttpClient";

import { 
    RestClient, 
    IRequestOptions, 
    IRestResponse 
} from "typed-rest-client/RestClient";

import * as Util from "./utility";
import { 
    IAzureMetricAlertRequestBody,
    IAzureMetricAlertRule
} from "./interfaces";

var httpObj = new HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var restObj = new RestClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));

var defaultAuthUrl = 'https://login.windows.net/';

function getAuthorizationToken(endPoint): Q.Promise<string> {

    let deferred: Q.Deferred<string> = Q.defer<string>();
    let envAuthUrl = (endPoint.envAuthUrl) ? (endPoint.envAuthUrl) : defaultAuthUrl;
    let authorityUrl = envAuthUrl + endPoint.tenantID + "/oauth2/token/";
    let requestData = querystring.stringify({
        resource: endPoint.activeDirectoryResourceId,
        client_id: endPoint.servicePrincipalClientID,
        grant_type: "client_credentials",
        client_secret: endPoint.servicePrincipalKey
    });

    let requestHeader = {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
    }

    tl.debug('Requesting for Auth Token: ' + authorityUrl);
    httpObj.post(authorityUrl, requestData, requestHeader)
        .then(async (response: HttpClientResponse) => {
            if (response.message.statusCode == 200) {
                let contents: string = await response.readBody();
                if(!!contents) {
                    deferred.resolve(JSON.parse(contents).access_token);
                }
            }
            else {
                deferred.reject(tl.loc('CouldnotfetchaccesstokenforAzureStatusCode', response.message.statusCode, response.message.statusMessage));
            }
        }, (error) => {
            deferred.reject(error);
        });

    return deferred.promise;
}

export async function getAzureRmResourceDetails(
    endpoint, 
    resourceUri: string) : Promise<any> {
    
    let deferred: Q.Deferred<any> = Q.defer<any>();
    let accessToken: string = await getAuthorizationToken(endpoint);
   
    // resourceUri is of the form : /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/{resourceProviderNamespace}/{resourceType}/{resourceName}

    let splittedResourceUri: string[] = resourceUri.split("/");
    let resourceGroupName: string = splittedResourceUri[4];
    let resourceType: string = splittedResourceUri[6] + "/" +  splittedResourceUri[7];
    let resourceName: string = splittedResourceUri[8];

    tl.debug(`Getting AzureRm resource details - '${resourceName}' in resource group '${resourceGroupName}'`);

    let apiVersion = "2017-05-10";
    let restUrl = `${endpoint.url}subscriptions/${endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/resources?$filter=resourceType EQ '${resourceType}' AND name EQ '${resourceName}'&api-version=${apiVersion}`;
    let restOptions: IRequestOptions = {
        additionalHeaders: {
            "Authorization": "Bearer " + accessToken
        }
    };

    restObj.get(restUrl, restOptions)
        .then((response: IRestResponse<any>) => {
            if(response.statusCode === 200) {
                deferred.resolve(response.result["value"][0]);
            }
            else {
                tl.debug(`Getting AzureRm resource '${resourceName}' failed. Status Code: ${response.statusCode}. Response: ${JSON.stringify(response.result, null, 2)}`);
                deferred.reject(response.statusCode);
            }

        }, (error) => {
            deferred.reject(error);
        });

    return deferred.promise;
}

export async function getAzureRmAlertRule(
    endpoint, 
    resourceGroupName: string, 
    alertRuleName: string) : Promise<any> {

    let deferred: Q.Deferred<any> = Q.defer<any>();
    let accessToken: string = await getAuthorizationToken(endpoint);

    tl.debug(`Getting AzureRm alert rule - '${alertRuleName}' in resource group '${resourceGroupName}'`);

    let apiVersion: string = "2016-03-01";
    let restUrl: string = `${endpoint.url}subscriptions/${endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.insights/alertrules/${alertRuleName}?api-version=${apiVersion}`;
    let restOptions: IRequestOptions = {
        additionalHeaders: {
            "Authorization": "Bearer " + accessToken
        }
    };

    restObj.get(restUrl, restOptions)
        .then((response: IRestResponse<any>) => {
            if(response.statusCode === 200) {
                deferred.resolve(response.result);
            }
            else {
                tl.debug(`Getting AzureRm alert '${alertRuleName}' failed. Status Code: ${response.statusCode}. Response: ${JSON.stringify(response.result, null, 2)}`);
                deferred.reject(response.statusCode);
            }

        }, (error) => {
            deferred.reject(error);
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
       
        existingAlertRule = await getAzureRmAlertRule(endpoint, resourceGroupName, rule.alertName);

        let existingAlertRuleTargetResourceUri: string = existingAlertRule["properties"].condition.dataSource.resourceUri;
        if(existingAlertRuleTargetResourceUri && existingAlertRuleTargetResourceUri.toLowerCase() !== resourceUri.toLowerCase()) {
            return Q.reject(tl.loc("AlertRuleTargetResourceIdMismatchError", rule.alertName, existingAlertRuleTargetResourceUri));
        }

        console.log(tl.loc("AlertRuleExists", rule.alertName, resourceGroupName));
    }
    catch (error) {
        if(error === 404) {
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
        alertRuleResourceLocation = resourceMetadataResponse.location;
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
            description: `Updated via ${Util.getDeploymentUri()}`, 
            isEnabled: true,
            condition: {
                "odata.type": "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition",
                "dataSource": {
                    "odata.type": "Microsoft.Azure.Management.Insights.Models.RuleMetricDataSource",
                    "resourceUri": resourceUri,
                    "metricName": rule.metric.value,
                    "operator": Util.getThresholdConditionForMetricAlertRule(rule.thresholdCondition)
                },
                "threshold": rule.thresholdValue,
                "windowSize": Util.getWindowSizeForMetricAlertRule(rule.timePeriod)
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
    notifyEmails: string) : Promise<any> {
   
    let deferred: Q.Deferred<any> = Q.defer<any>();
    let accessToken: string = await getAuthorizationToken(endpoint);
   
    let requestBody: IAzureMetricAlertRequestBody = await getRequestBodyForAddingAlertRule(endpoint, resourceGroupName, resourceUri, rule, notifyServiceOwners, notifyEmails);
    tl.debug(`Sending PUT request with request body \n${JSON.stringify(requestBody, null, 2)}`); 

    let apiVersion = "2016-03-01";
    let restUrl = `${endpoint.url}subscriptions/${endpoint.subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.insights/alertrules/${rule.alertName}?api-version=${apiVersion}`;
    let restOptions: IRequestOptions = {
        additionalHeaders: {
            "Authorization": "Bearer " + accessToken
        }
    };

    restObj.replace(restUrl, requestBody, restOptions)
        .then((response) => {
            if(response.statusCode === 200 || response.statusCode === 201) {
                deferred.resolve(response);
            }
            else {
                tl.debug(`Updating the rule ${rule.alertName} failed. ${JSON.stringify(response.result, null, 2)}`);
                deferred.reject(response.statusCode);
            }
        }, (error) => {
            deferred.reject(error);
        });

    return deferred.promise;
}
