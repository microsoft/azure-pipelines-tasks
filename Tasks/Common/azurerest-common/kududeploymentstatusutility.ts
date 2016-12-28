import tl = require('vsts-task-lib/task');

export function generateDeploymentId(): string{
    var buildUrl = tl.getVariable('build.buildUri');
    var releaseUrl = tl.getVariable('release.releaseUri');

    var buildId = tl.getVariable('build.buildId');
    var releaseId = tl.getVariable('release.releaseId');

    if(releaseUrl !== undefined) {
        return releaseId + Date.now();
    }
    else if(buildUrl !== undefined) {
        return buildId + Date.now();
    }
    else {
        throw new Error(tl.loc('CannotupdatedeploymentstatusuniquedeploymentIdCannotBeRetrieved'));
    }
}

export function getUpdateHistoryRequest(webAppPublishKuduUrl: string, isDeploymentSuccess: boolean, customMessage, deploymentId: string): any {
    
    var status = isDeploymentSuccess ? 4 : 3;
    var status_text = (status == 4) ? "success" : "failed";
    var author = getDeploymentAuthor();

    var buildUrl = tl.getVariable('build.buildUri');
    var releaseUrl = tl.getVariable('release.releaseUri');

    var buildId = tl.getVariable('build.buildId');
    var releaseId = tl.getVariable('release.releaseId');
	
	var buildNumber = tl.getVariable('build.buildNumber');
	var releaseName = tl.getVariable('release.releaseName');

    var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri'); 
    var teamProject = tl.getVariable('system.teamProject');

 	var commitId = tl.getVariable('build.sourceVersion');
 	var repoName = tl.getVariable('build.repository.name');
 	var repoProvider = tl.getVariable('build.repository.provider');

    var buildOrReleaseUrl = "" ;
    deploymentId = deploymentId ? deploymentId : generateDeploymentId();

    if(releaseUrl !== undefined) {
        buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
    }
    else if(buildUrl !== undefined) {
        buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
    }
    else {
        throw new Error(tl.loc('CannotupdatedeploymentstatusuniquedeploymentIdCannotBeRetrieved'));
    }

    var message = {
		type : customMessage.type,
		commitId : commitId,
		buildId : buildId,
		releaseId : releaseId,
		buildNumber : buildNumber,
		releaseName : releaseName,
		repoProvider : repoProvider,
		repoName : repoName,
		collectionUrl : collectionUrl,
		teamProject : teamProject
	};
    // Append Custom Messages to original message
    for(var attribute in customMessage) {
        message[attribute] = customMessage[attribute];
    }

    var deploymentLogType: string = message['type'];
    var active: boolean = false;
    if(deploymentLogType.toLowerCase() === "deployment") {
        active = true;
    }

    var requestBody = {
        active : active,
        status : status,
        status_text : status_text, 
        message : JSON.stringify(message),
        author : author,
        deployer : 'VSTS',
        details : buildOrReleaseUrl
    };

    var webAppHostUrl = webAppPublishKuduUrl.split(':')[0];
    var requestUrl = "https://" + encodeURIComponent(webAppHostUrl) + "/deployments/" + encodeURIComponent(deploymentId);

    var requestDetails = {
        "requestBody": requestBody,
        "requestUrl": requestUrl    
    };
    return requestDetails;
}

function getDeploymentAuthor(): string {
    var author = tl.getVariable('build.sourceVersionAuthor');
 
    if(author === undefined) {
        author = tl.getVariable('build.requestedfor');
    }

    if(author === undefined) {
        author = tl.getVariable('release.requestedfor');
    }

    if(author === undefined) {
        author = tl.getVariable('agent.name');
    }

    return author;
}