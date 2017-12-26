import tl = require('vsts-task-lib/task');

export function generateDeploymentId(): string {
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

export function getDeploymentUri(): string {
    let buildUri = tl.getVariable("Build.BuildUri");
    let releaseWebUrl = tl.getVariable("Release.ReleaseWebUrl");
    let collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
    let teamProject = tl.getVariable('System.TeamProjectId');
    let buildId = tl.getVariable('build.buildId');

    if (!!releaseWebUrl) {
        return releaseWebUrl;
    }

    if (!!buildUri) {
        return `${collectionUrl}${teamProject}/_build?buildId=${buildId}&_a=summary`;
    }

    return "";
}
