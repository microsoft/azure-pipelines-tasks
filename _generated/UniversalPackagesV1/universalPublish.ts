import * as tl from "azure-pipelines-task-lib";
import type { IExecSyncResult } from "azure-pipelines-task-lib/toolrunner";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities";
import { UniversalPackageContext } from "./UniversalPackageContext";
import * as helpers from "./universalPackageHelpers";

export async function run(context: UniversalPackageContext): Promise<void> {
    try {
        // Resolve packageVersion if using versionIncrement
        let packageVersion = context.packageVersion;
        if (context.versionIncrement) {
            packageVersion = await resolveVersionIncrement(context);
        }

        helpers.logInfo('Info_PublishingPackage', context.packageName, packageVersion, context.directory);
        
        // Get provenance session ID if using service connection, otherwise use feedName
        // Build Service provides metadata automatically; service connections require provenance
        const feedId = context.feedName;

        // Publish the package
        tl.debug(tl.loc("Debug_UsingArtifactToolPublish"));
        publishPackageUsingArtifactTool(context, feedId, packageVersion);
        tl.setVariable('packageName', context.packageName, false, true);
        tl.setVariable('packageVersion', packageVersion, false, true);
        tl.debug(tl.loc('Debug_SetOutputVariables', context.packageName, packageVersion));

        helpers.logInfo("Success_PackagesPublished", context.packageName, packageVersion, context.feedName);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesPublished", context.packageName, packageVersion, context.feedName));
    } catch (err) {
        await helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToPublish', context.packageName, context.packageVersion || context.versionIncrement, context.feedName), context);
    }
}

async function resolveVersionIncrement(context: UniversalPackageContext): Promise<string> {
    tl.debug(tl.loc('Debug_ResolvingVersionIncrement', context.versionIncrement));

    // Query the feed for the highest existing version
    // Must use feedServiceUri (https://feeds.dev.azure.com) not serviceUri (https://dev.azure.com)
    // because the Packaging API is hosted on the feeds subdomain
    const highestVersion = await artifactToolUtilities.getHighestPackageVersionFromFeed(
        context.feedServiceUri,
        context.accessToken,
        context.projectName,
        context.feedName,
        context.packageName
    );

    tl.debug(tl.loc('Debug_HighestPackageVersion', highestVersion));

    // Increment the version based on the increment type
    const newVersion = artifactToolUtilities.getVersionUtility(context.versionIncrement, highestVersion);
    
    if (!newVersion) {
        throw new Error(tl.loc('Error_InvalidVersionIncrement', context.versionIncrement));
    }

    tl.debug(tl.loc('Debug_CalculatedVersion', newVersion));
    helpers.logInfo('Info_UsingIncrementedVersion', newVersion, context.versionIncrement, highestVersion);

    return newVersion;
}

function publishPackageUsingArtifactTool(context: UniversalPackageContext, feedId: string, packageVersion: string) {
    const command = new Array<string>();
    command.push(
        "universal", "publish",
        "--feed", feedId,
        "--service", context.serviceUri,
        "--package-name", context.packageName,
        "--package-version", packageVersion,
        "--path", context.directory,
        "--patvar", "UNIVERSAL_AUTH_TOKEN",
        "--verbosity", context.verbosity);

    if (context.projectName) {
        command.push("--project", context.projectName);
    }

    if (context.packageDescription) {
        command.push("--description", context.packageDescription);
    }

    tl.debug(tl.loc("Debug_Publishing", context.packageName, packageVersion, feedId, context.projectName));
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

