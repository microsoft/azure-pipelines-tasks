import * as tl from "azure-pipelines-task-lib";
import { IExecSyncResult } from "azure-pipelines-task-lib/toolrunner";
import { ProvenanceHelper } from "azure-pipelines-tasks-packaging-common/provenance";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import { UniversalPackageContext } from "./UniversalPackageContext";
import * as helpers from "./universalPackageHelpers";

export async function run(context: UniversalPackageContext): Promise<void> {
    tl.debug(tl.loc('Debug_PublishOperation', context.packageName, context.packageVersion, context.directory));
    
    // Get provenance session ID (use feedName as fallback)
    const feedId = await tryGetProvenanceSessionId(context);

    // Publish the package
    try {
        tl.debug(tl.loc("Debug_UsingArtifactToolPublish"));
        publishPackageUsingArtifactTool(context, feedId);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesPublished"));
    } catch (err) {
        helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToPublish'), context);
    }
}

async function tryGetProvenanceSessionId(context: UniversalPackageContext): Promise<string> {
    try {
        // Create WebApi connection for provenance
        const webApi = getWebApiWithProxy(context.serviceUri, context.accessToken);
        
        const sessionId = await ProvenanceHelper.GetSessionId(
            context.feedName,
            context.projectName,
            "upack", /* must match protocol name on the server */
            webApi.serverUrl,
            [webApi.authHandler],
            webApi.options);

        if (sessionId != null) {
            tl.debug(tl.loc('Debug_UsingProvenanceSession', sessionId));
            return sessionId;
        } else {
            tl.debug(tl.loc('Debug_NoProvenanceSession'));
            return context.feedName;
        }
    } catch (err) {
        tl.warning(tl.loc('Warning_FailedToGetProvenanceSession', err.message || err));
        return context.feedName;
    }
}

function publishPackageUsingArtifactTool(context: UniversalPackageContext, feedId: string) {
    const command = new Array<string>();
    command.push(
        "universal", "publish",
        "--feed", feedId,
        "--service", context.serviceUri,
        "--package-name", context.packageName,
        "--package-version", context.packageVersion,
        "--path", context.directory,
        "--patvar", "UNIVERSAL_AUTH_TOKEN",
        "--verbosity", tl.getInput("verbosity"));

    if (context.projectName) {
        command.push("--project", context.projectName);
    }

    const packageDescription = tl.getInput("packageDescription");
    if (packageDescription) {
        command.push("--description", packageDescription);
    }

    tl.debug(tl.loc("Debug_Publishing", context.packageName, context.packageVersion, feedId, context.projectName));
    const execResult: IExecSyncResult = helpers.artifactToolRunner.runArtifactTool(
        context.artifactToolPath,
        command,
        context.toolRunnerOptions);

    if (execResult.code === 0) {
        return;
    }

    helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolPublish",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
