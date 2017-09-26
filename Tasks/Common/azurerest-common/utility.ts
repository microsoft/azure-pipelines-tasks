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

export function getJobIdName(): string {
    let buildName: string = tl.getVariable("Build.BuildName");
    let buildId: string = tl.getVariable("Build.BuildId");

    let releaseName: string = tl.getVariable("Release.ReleaseName");
    let releaseId: string = tl.getVariable("Release.ReleaseId");

    if(!!buildName) {
        return `BUILD_${buildName}_${buildId}`;
    }

    if(!!releaseName) {
        return `RELEASE_${releaseName}_${releaseId}`;
    }

    return "";
}