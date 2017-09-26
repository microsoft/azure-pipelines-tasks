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

export function getResourceGroupName(resourceId) {
    var resourceGroupName = null;

    if(resourceId) {
        var resourceIdComponents = resourceId.split('/');
        if(resourceIdComponents.length > 4) {
            resourceGroupName =  resourceIdComponents[4];
        }
    }

    return resourceGroupName;
}
