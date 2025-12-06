import * as tl from "azure-pipelines-task-lib";
import { IExecOptions, IExecSyncResult } from "azure-pipelines-task-lib/toolrunner";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import { ProvenanceHelper } from "azure-pipelines-tasks-packaging-common/provenance";
import * as helpers from "./universalPackageHelpers";

export async function run(artifactToolPath: string, authInfo: helpers.AuthenticationInfo): Promise<void> {
    // Get and validate inputs
    const inputs = helpers.getUniversalPackageInputs();
    const feedInfo = helpers.parseFeedInfo(inputs.organization, inputs.feed);
    
    try {
        tl.debug(tl.loc('Debug_PublishOperation', inputs.packageName, inputs.packageVersion, inputs.directory));
        
        // Initialize feedId with feedName (may be overridden by sessionId for provenance)
        let feedId = feedInfo.feedName;
        let sessionId: string;

        // Set up provenance session
        const packagingLocation = await helpers.getPackagingLocation(feedInfo.serviceUri);
        
        const pkgConn = getWebApiWithProxy(packagingLocation, authInfo.accessToken);
        sessionId = await ProvenanceHelper.GetSessionId(
            feedId,
            feedInfo.projectName,
            "upack", /* must match protocol name on the server */
            pkgConn.serverUrl,
            [pkgConn.authHandler],
            pkgConn.options);

        tl.debug(tl.loc("Debug_UsingArtifactToolPublish"));

        // Override feedId with sessionId for provenance if available
        if (sessionId != null) {
            tl.debug(tl.loc('Debug_UsingProvenanceSession', sessionId));
            feedId = sessionId;
        } else {
            tl.debug(tl.loc('Debug_NoProvenanceSession'));
        }

        const publishOptions = {
            artifactToolPath,
            projectId: feedInfo.projectName,
            feedId,
            accountUrl: feedInfo.serviceUri,
            packageName: inputs.packageName,
            packageVersion: inputs.packageVersion,
        } as helpers.artifactToolRunner.IArtifactToolOptions;

        publishPackageUsingArtifactTool(inputs.directory, publishOptions, authInfo.toolRunnerOptions);

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesPublished"));
    } catch (err) {
        helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToPublish'), feedInfo);
    }
}

function publishPackageUsingArtifactTool(
    publishDir: string,
    options: helpers.artifactToolRunner.IArtifactToolOptions,
    execOptions: IExecOptions) {
    const command = new Array<string>();
    command.push(
        "universal", "publish",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", publishDir,
        "--patvar", "UNIVERSAL_AUTH_TOKEN",
        "--verbosity", tl.getInput("verbosity"));

    if (options.projectId) {
        command.push("--project", options.projectId);
    }

    const packageDescription = tl.getInput("packageDescription");
    if (packageDescription) {
        command.push("--description", packageDescription);
    }

    tl.debug(tl.loc("Debug_Publishing", options.packageName, options.packageVersion, options.feedId, options.projectId));
    const execResult: IExecSyncResult = helpers.artifactToolRunner.runArtifactTool(
        options.artifactToolPath,
        command,
        execOptions);

    if (execResult.code === 0) {
        return;
    }

    helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolPublish",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
