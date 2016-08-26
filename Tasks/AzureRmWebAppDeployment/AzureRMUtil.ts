/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

var adal = require ('adal-node');
var request = require ('request');
var parseString = require('xml2js').parseString;

import tl = require('vsts-task-lib/task');
import Q = require('q');

var AuthenticationContext = adal.AuthenticationContext;
var authUrl = 'https://login.windows.net/';
var armUrl = 'https://management.azure.com/';


export async function getAzureRMWebAppPublishProfile(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {
    if(!deployToSlotFlag) {
        var webAppID = await getAzureRMWebAppDetails(SPN, webAppName, 'Microsoft.Web/Sites');
        //    webAppID Format ==> /subscriptions/<subscriptionId>/resourceGroups/<resource_grp_name>/providers/Microsoft.Web/sites/<webAppName>
        resourceGroupName = webAppID.id.split ('/')[4];
    }
    var publishProfile = await getWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
    return publishProfile;
}

export function updateDeploymentStatus(publishingProfile, isDeploymentSuccess: boolean):Q.Promise<string>  {
    var deferred = Q.defer<string>();

    var webAppPublishKuduUrl = publishingProfile.publishUrl;
    if(webAppPublishKuduUrl) {
        var requestDetails = getUpdateHistoryRequest(webAppPublishKuduUrl, isDeploymentSuccess);
        var requestOptions = {
            url : requestDetails["requestUrl"],
            method : 'PUT', 
            json : requestDetails["requestBody"],
            auth: {
                username : publishingProfile.userName,
                password : publishingProfile.userPWD
            }
        };

        request( requestOptions , (error, response, body ) => {
            if (error) {
                deferred.reject(error);
            }
            else if ( response.statusCode === 200 ) {
                deferred.resolve(tl.loc("Updatedeploymenthistoryissuccess"));
            }
            else {
                deferred.reject(tl.loc("Failedtoupdatedeploymenthistory"));
            }
        });
    }
    else {
        deferred.reject(tl.loc('WARNINGCannotupdatedeploymentstatusSCMendpointisnotenabledforthiswebsite'));
    }
    return deferred.promise;
}

function getAuthorizationToken(SPN): Q.Promise<string> {

    var deferred = Q.defer<string>();
    var authorityUrl = authUrl + SPN.tenantID;

    var context = new AuthenticationContext (authorityUrl);
    context.acquireTokenWithClientCredentials (armUrl, SPN.servicePrincipalClientID, SPN.servicePrincipalKey, (error, tokenResponse) => {
        if(error) 
            deferred.reject(error);
        else {
            deferred.resolve(tokenResponse.accessToken);
        }
    });

    return deferred.promise;
}

function getDeploymentAuthor(): string {
    var author = tl.getVariable('build.sourceVersionAuthor');
    if ( author === undefined )  {
        author = tl.getVariable('build.requestedfor');
        if (author === undefined) {
            author = tl.getVariable('release.requestedfor');
        }

        if (author === undefined) {
            author = tl.getVariable ('agent.name');
        }
    }
    return author;
}

function getUpdateHistoryRequest(webAppPublishKuduUrl: string, isDeploymentSuccess: boolean): any {
    
    var status = isDeploymentSuccess ? 4 : 3;
    var author = getDeploymentAuthor();

    var buildUrl = tl.getVariable('build.buildUri');
    var    releaseUrl = tl.getVariable ('release.releaseUri');

    var buildId = tl.getVariable('build.buildId');
    var    releaseId = tl.getVariable('release.releaseId');

    var collectionUrl = tl.getVariable ('system.TeamFoundationCollectionUri'); 
    var    teamProject = tl.getVariable ('system.teamProject');

    var buildOrReleaseUrl = "" ;
    var deploymentId = "";

    if(releaseUrl !== undefined) {
        deploymentId = releaseId + Date.now();
        buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
    }
    else if(buildUrl !== undefined){
        deploymentId = buildId + Date.now();
        buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
    }
    else {
        throw new Error(tl.loc('CannotupdatedeploymentstatusuniquedeploymentIdCannotBeRetrieved'));
    }

    var message = "Updating Deployment History For Deployment " + buildOrReleaseUrl;
    var requestBody = {
        status : status,
        status_text : status == 4 ? "success" : "failed", 
        message : message,
        author : author,
        deployer : 'VSTS',
        details : buildOrReleaseUrl
    };

    var webAppHostUrl = webAppPublishKuduUrl.split(':')[0];
    var requestUrl = "https://" + encodeURIComponent(webAppHostUrl) + "/deployments/" + encodeURIComponent(deploymentId);

    var requestDetails = new Array<string>();
    requestDetails["requestBody"] = requestBody;
    requestDetails["requestUrl"] = requestUrl;
    return requestDetails;
}

async function getWebAppPublishProfile(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string ) {

    var deferred = Q.defer();
    var slotUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    var accessToken = await getAuthorizationToken(SPN);
    
    var requestOptions = {
        url: armUrl + 'subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName +
                 '/providers/Microsoft.Web/sites/' + webAppName + slotUrl + '/publishxml?api-version=2015-08-01',
        auth: {
            bearer: accessToken
        },
        method: 'POST'
    };
    request(requestOptions, (error, response, body) => {
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
            deferred.reject(tl.loc('ErrorFetchingDeploymentPublishProfileStausCode0', response.statusCode));
        }
    });

    return deferred.promise;
}

async function getAzureRMWebAppDetails(SPN, webAppName: string, resourceType: string) {

    var deferred = Q.defer<any>();
    var accessToken = await getAuthorizationToken(SPN);
    var requestOptions = {
        url:  armUrl + 'subscriptions/' + SPN.subscriptionId + '/resources?$filter=resourceType EQ \'' + resourceType +
                        '\' AND name EQ \'' + webAppName + '\'&api-version=2016-07-01',
        auth: {
            bearer: accessToken
        }
    };

    request (requestOptions, (error, response, body) => {
        if( error ) {
            deferred.reject(error);
        }
        else if(response.statusCode === 200) {
            var obj = JSON.parse(body);
            deferred.resolve(obj.value[0]);
        }
        else {
            deferred.reject(tl.loc('ErrorOccurredStausCode0',response.statusCode));
        }
    });

    return deferred.promise;
}