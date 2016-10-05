import tl = require('vsts-task-lib/task');

export function getUpdateHistoryRequest(webAppPublishKuduUrl: string, isSlotSwapSuccess: boolean, slot1: string, slot2: string): any {
    
    var status = isSlotSwapSuccess ? 4 : 3;
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
	
	var type = "SlotSwap";
 	var commitId = tl.getVariable('build.sourceVersion');
 	var repoName = tl.getVariable('build.repository.name');
 	var repoProvider = tl.getVariable('build.repository.provider');

    var buildOrReleaseUrl = "" ;
    var deploymentId = "";

    if(releaseUrl !== undefined) {
        deploymentId = releaseId + Date.now();
        buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
    }
    else if(buildUrl !== undefined) {
        deploymentId = buildId + Date.now();
        buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
    }
    else {
        throw new Error(tl.loc('CannotupdatedeploymentstatusuniquedeploymentIdCannotBeRetrieved'));
    }

    var message = JSON.stringify({
		type : type,
        slot1 : slot1,
        slot2 : slot2,
		commitId : commitId,
		buildId : buildId,
		releaseId : releaseId,
		buildNumber : buildNumber,
		releaseName : releaseName,
		repoProvider : repoProvider,
		repoName : repoName,
		collectionUrl : collectionUrl,
		teamProject : teamProject
	});
	
    var requestBody = {
        status : status,
        status_text : status_text, 
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