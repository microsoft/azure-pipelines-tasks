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