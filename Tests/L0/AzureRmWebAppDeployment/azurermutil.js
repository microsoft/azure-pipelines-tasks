/// <reference path="../../definitions/vsts-task-lib.d.ts" />
"use strict";

const tl = require('vsts-task-lib/task');
function getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName) {
	
	var mockPublishProfile = {
		profileName: 'mytestapp - Web Deploy',
 		publishMethod: 'MSDeploy',
		publishUrl: 'mytestappKuduUrl',
		msdeploySite: 'mytestapp',
		userName: '$mytestapp',
		userPWD: 'mytestappPwd',
		destinationAppUrl: 'mytestappUrl',
		SQLServerDBConnectionString: '',
		mySQLDBConnectionString: '',
		hostingProviderForumLink: '',
		controlPanelLink: '',
		webSystem: 'WebSites' 
	};

	if(deployToSlotFlag) {
		mockPublishProfile.profileName =  'mytestapp-' + slotName + ' - Web Deploy';
		mockPublishProfile.publishUrl = 'mytestappKuduUrl-' + slotName;
		mockPublishProfile.msdeploySite = 'mytestapp__' + slotName;
		mockPublishProfile.userName = '$mytestapp__' + slotName;
		mockPublishProfile.userPWD = 'mytestappPwd';
		mockPublishProfile.destinationAppUrl = 'mytestappUrl-' + slotName;
	}

	return mockPublishProfile;

}
exports.getAzureRMWebAppPublishProfile = getAzureRMWebAppPublishProfile;

function updateDeploymentStatus(publishingProfile, isDeploymentSuccess ) {
	if(isDeploymentSuccess) {
		console.log('Updated history to kudu');
	}
	else {
		console.log('Failed to update history to kudu');
	}
	getUpdateHistoryRequest(publishingProfile, isDeploymentSuccess);
}
exports.updateDeploymentStatus = updateDeploymentStatus;

function getDeploymentAuthor() {
    var author = tl.getVariable('build.sourceVersionAuthor');
    
    if(author == null) {
        author = tl.getVariable('build.requestedfor');
    }
    if(author == null) {
        author = tl.getVariable('release.requestedfor');
    }
    if(author == null) {
        author = tl.getVariable('agent.name');
    }

    return author;
}
exports.getDeploymentAuthor = getDeploymentAuthor;

function getUpdateHistoryRequest(publishingProfile, isDeploymentSuccess) {
	var status = isDeploymentSuccess ? 4 : 3;
    var status_text = (status == 4) ? 'success' : 'failed';
    var author = getDeploymentAuthor();

    var buildUrl = tl.getVariable('build.buildUri');
    var releaseUrl = tl.getVariable('release.releaseUri');

    var buildId = tl.getVariable('build.buildId');
    var releaseId = tl.getVariable('release.releaseId');
	
	var buildNumber = tl.getVariable('build.buildNumber');
	var releaseName = tl.getVariable('release.releaseName');

    var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri'); 
    var teamProject = tl.getVariable('system.teamProject');
	
	var type = 'Deployment';
	var commitId = tl.getVariable('build.sourceVersion');
	var repoName = tl.getVariable('build.repository.name');
	var repoProvider = tl.getVariable('build.repository.provider');
	
	var slotName = "";
	if(publishingProfile.publishUrl.search('-') == -1)
		slotName = 'Production'
	else
		slotName = publishingProfile.publishUrl.substring(publishingProfile.publishUrl.search('-') + 1);

	var buildOrReleaseUrl = 'not available';
    var deploymentId = '';
	
	if(releaseUrl != null) {
        deploymentId = releaseId + Date.now();
        buildOrReleaseUrl = collectionUrl + teamProject + '/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=' + releaseId + '&_a=release-summary';
    }
    else if(buildUrl != null) {
        deploymentId = buildId + Date.now();
        buildOrReleaseUrl = collectionUrl + teamProject + '/_build?buildId=' + buildId + '&_a=summary';
    }
    else {
        console.log('Cannot update deployment status unique deploymentId Cannot Be Retrieved');
    }

	var message = JSON.stringify({
		type : type,
		commitId : commitId,
		buildId : buildId,
		releaseId : releaseId,
		buildNumber : buildNumber,
		releaseName : releaseName,
		repoProvider : repoProvider,
		repoName : repoName,
		collectionUrl : collectionUrl,
		teamProject : teamProject,
		slotName : slotName
	});
	
    var requestBody = JSON.stringify({
        status : status,
        status_text : status_text, 
        message : message,
        author : author,
        deployer : 'VSTS',
        details : buildOrReleaseUrl
    });

	console.log('kudu log requestBody is:' + requestBody);
}
exports.getUpdateHistoryRequest = getUpdateHistoryRequest;

function getAzureRMWebAppConfigDetails(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName) {
	var config = { 
		id: 'appid',
  		properties: { 
     		virtualApplications: [ ['Object'], ['Object'], ['Object'] ],
    	} 
  	}

    return config;
}
exports.getAzureRMWebAppConfigDetails = getAzureRMWebAppConfigDetails;