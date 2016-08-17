/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

var adal = require ('adal-node');
var request = require ('request');
var parseString = require('xml2js').parseString;

import taskLib = require ('vsts-task-lib/task');
import Q = require('q');

var AuthenticationContext = adal.AuthenticationContext;

function getAuthorizationToken ( SPN ) : Q.Promise <string> {

	var deferred = Q.defer<string>();
	var authorityUrl = 'https://login.windows.net/' + SPN.tenantID; 
	var resource = 'https://management.azure.com/';

	var context = new AuthenticationContext (authorityUrl);
	context.acquireTokenWithClientCredentials (resource, SPN.servicePrincipalClientID, SPN.servicePrincipalKey, function ( error, tokenResponse) {
		if ( error ) 
			deferred.reject ( error );
		else {
			deferred.resolve ( tokenResponse.accessToken );
		}
	});

	return deferred.promise;
}

exports.getAzureRMWebAppDetails = function ( SPN, webAppName : string ) : Q.Promise<any> {

	var deferred = Q.defer<any> ();

	getAuthorizationToken(SPN)
	.then(function (accessToken : string) {
		
 		var requestOptions = {
 		 	url : 'https://management.azure.com/subscriptions/' + SPN.subscriptionId + '/resources?$filter=resourceType eq \'Microsoft.Web%2FSites\'&api-version=2016-02-01',
 		 	auth : {
 		 		bearer : accessToken
 		 	}
 		 };

 		request (requestOptions, function (error, response, body) {
 		 	if ( error ) 
 		 		deferred.reject (error);
 		 	else {
 		 		if ( response.statusCode === 200 ) {
 		 			var obj = JSON.parse (body);
 		 			for ( var i = 0; i < Object.keys (obj.value).length; i++ ) {
 		 				if ( obj.value[i].name == webAppName ) {
 		 					deferred.resolve (obj.value[i]);
						}
					}
 		 			deferred.reject ('Error Occurred : No such web app');
 		 		}
 		 		else deferred.reject ('Error Occurred : [Staus Code : '+response.statusCode+']');

 		 	}
 		});
 		
	}, function (error) {
		taskLib.error (error);
	});

	return deferred.promise;

};

function getPublishProfileUtil ( SPN, webAppName: string, resourceGroupName: string, publishMethod: string, deployToSlotFlag: boolean, slotName: string ): Q.Promise<any> {

    var deferred = Q.defer();
    var insertInUrl = deployToSlotFlag ? "/slots/" + slotName : "";
    getAuthorizationToken(SPN)
        .then(function (accessToken) {
        var requestOptions = {
            url: 'https://management.azure.com/subscriptions/' + SPN.subscriptionId + '/resourceGroups/' + resourceGroupName + '/providers/Microsoft.Web/sites/' + webAppName + insertInUrl + '/publishxml?api-version=2015-08-01',
            auth: {
                bearer: accessToken
            },
            method: 'POST'
        };
        request(requestOptions, function (error, response, body) {
            if (error)
                deferred.reject(error);
            else {
                if (response.statusCode === 200) {
                    parseString(body, function (error, result) {
                        for (var i in result.publishData.publishProfile) {
                            if (result.publishData.publishProfile[i].$.publishMethod === publishMethod)
                                deferred.resolve(result.publishData.publishProfile[i].$);
						}
                        deferred.reject('Error : No Such Deploying Method Exists');
                    });
                }
                else {
                    deferred.reject('Error Fetching Deployment Publish Profile [Staus Code : '+response.statusCode+']');
                }
            }
        });
    }, function (error) {
        taskLib.error(error);
    });

    return deferred.promise;
}
exports.getAzureRMWebAppPublishingProfileDetails = function (SPN, webAppName: string, resourceGroupName: string, publishMethod: string, deployToSlotFlag: boolean, slotName: string): Q.Promise<any> {
    var deferred = Q.defer();
      
    if ( !deployToSlotFlag ) {
        getAzureRMWebAppDetails_version2( SPN, webAppName,'Microsoft.Web/Sites').then ( function (webAppID) {
			/*
				webAppID --> /subscriptions/<subscriptionId>/resourceGroups/<resource_grp_name>/providers/Microsoft.Web/sites/<webAppName>
				The fourth string represents the Resource group name for the corresponding web app name.
			*/
            resourceGroupName = webAppID.id.split ('/')[4];
            getPublishProfileUtil ( SPN, webAppName, resourceGroupName, publishMethod, deployToSlotFlag, slotName).then ( function (publishProfile) {
                deferred.resolve (publishProfile);
            }, function (error) {
                deferred.reject (error);
            });
        }, function ( error ) {
            deferred.reject (error);
        });
    } 
    else  {
        
        getPublishProfileUtil ( SPN, webAppName, resourceGroupName, publishMethod, deployToSlotFlag, slotName).then ( function (publishProfile) {
                deferred.resolve (publishProfile);
        }, function (error) {
            deferred.reject (error);
        });

    }
    
    return deferred.promise;
};

function getAzureRMWebAppDetails_version2 ( SPN, webAppName : string, resourceType : string ) : Q.Promise<any> {

	var deferred = Q.defer<any>();

	getAuthorizationToken(SPN)
	.then(function (accessToken : string) {
		
 		var requestOptions = {
 		 	url: 'https://management.azure.com/subscriptions/' + SPN.subscriptionId + '/resources?$filter=resourceType EQ \'' + resourceType + '\' AND name EQ \'' + webAppName + '\'&api-version=2016-07-01',
 		 	auth : {
 		 		bearer : accessToken
 		 	}
 		 };

 		request (requestOptions, function (error, response, body) {
 		 	if ( error ) 
 		 		deferred.reject (error);
 		 	else {
 		 		if ( response.statusCode === 200 ) {
 		 			var obj = JSON.parse (body);
 		 			deferred.resolve (obj.value[0]);
 		 		}
 		 		else deferred.reject ('Error Occurred : [Staus Code : '+response.statusCode+']');

 		 	}
 		});
 		
	}, function (error) {
		taskLib.error(error);
	});

	return deferred.promise;

}
exports.getAzureRMWebAppDetails_version2 = getAzureRMWebAppDetails_version2;

function updateDeploymentStatus (azureRMWebAppConnectionDetails, deployAzureWebsiteError : boolean) {

	var webAppPublishKuduUrl = azureRMWebAppConnectionDetails.KuduHostName;
	
	if ( webAppPublishKuduUrl ) {

		var status = 3;	 // Set default status as failed 
		var status_text = 'failed';

		if ( !deployAzureWebsiteError ) {
			status = 4;
			status_text = 'succeeded';
		}

		/* ----------------------------------------------------------------------------------------
		username = azureRMWebAppConnectionDetails.UserName;
		securePwd = < convert to secure string > azureRMWebAppConnectionDetails.UserPassword;

		credential = System.Management.Automation.PSCredential (username, securePwd);
		------------------------------------------------------------------------------------------ */

		// Get Author of build or release 

		var author = taskLib.getVariable ('build.sourceVersionAuthor');
		if ( author === undefined )  {
			author = taskLib.getVariable ('build.requestedfor');
			if ( author === undefined )
				author = taskLib.getVariable ('release.requestedfor');

			if ( author === undefined )
				author = taskLib.getVariable ('agent.name');
		}
		
		// Use buildId/releaseId to update deployment Status 
		// Use buildUrl/releaseUrl to update deployment message 

		var buildUrlTaskVar = taskLib.getVariable ('build.buildUri'), 
			releaseUrlTaskVar = taskLib.getVariable ('release.releaseUri');

		// Get the build id/number
		var buildIdTaskVar = taskLib.getVariable ('build.buildId'), 
			releaseIdTaskVar = taskLib.getVariable ('release.releaseId');

		var collectionUrl = taskLib.getVariable ('system.TeamFoundationCollectionUri'), 
			teamProject = taskLib.getVariable ('system.teamProject');	

		var buildOrReleaseUrl = "" ;
		var uniqueId = Date.now();		// //uniqueId = Get current date ddMMyyhhmmss ;
		var deploymentId = "";
		var message = "";

		if ( releaseUrlTaskVar != undefined ) {
			deploymentId = releaseIdTaskVar + uniqueId;
			buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseIdTaskVar + "&_a=release-summary";
			message = "Updating Deployment History For Deployment " + buildOrReleaseUrl;

		}		
		else {
			deploymentId = buildIdTaskVar + uniqueId;
			buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildIdTaskVar + "&_a=summary";
			message = "Updating Deployment History For Deployment " + buildOrReleaseUrl;
		}

		if ( deploymentId === undefined ) {
			// no point in proceeding further 
			taskLib.error('Cannot update deployment status : uniquedeploymentIdCannotBeRetrieved');
			return ;
		}

		var body = {
			status : status, 
			status_text : status_text, 
			message : message, 
			author : author, 
			deployer : 'VSTS', 
			details : buildOrReleaseUrl
		};
		
		var webAppHostUrl = webAppPublishKuduUrl.split(':')[0];
		var RESTurl = "https://" + encodeURIComponent(webAppHostUrl) + "/deployments/" + encodeURIComponent(deploymentId);

		try {

			/*
			INVOKE THE REST METHOD ...
			GET THE REST API FOR Invoke-RestMethod RESTurl -Credential credential -Method PUT -Body body
							-ContentType "application/json" -UserAgent 'myuseragent'
			*/
			var requestOptions = {
				url : RESTurl,
				method : 'PUT', 
				json : body, 
				auth: {
					username : azureRMWebAppConnectionDetails.UserName, 
					password : azureRMWebAppConnectionDetails.UserPassword
				}
			};

			request ( requestOptions , function (error, response, body ) { 
				if ( error ) 
					taskLib.debug(error);
				else {
					if ( response.statusCode === 200 ) {
						taskLib.debug(body);
					}
					else {
						taskLib.debug(response);
					}
				}
			});

		}
		catch ( error ) {
			taskLib.error(error);
		} 
	}
	else {
		taskLib.error('WARNING : Cannot update deployment status : SCM endpoint is not enabled for this website');
	}
}
exports.updateDeploymentStatus = updateDeploymentStatus;
