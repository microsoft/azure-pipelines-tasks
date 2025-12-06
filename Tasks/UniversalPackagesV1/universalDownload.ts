import * as tl from "azure-pipelines-task-lib";
import { IExecSyncResult, IExecOptions } from "azure-pipelines-task-lib/toolrunner";
import * as helpers from "./universalPackageHelpers";

export async function run(artifactToolPath: string, authInfo: helpers.AuthenticationInfo): Promise<void> {
    // Get and validate inputs
    const inputs = helpers.getUniversalPackageInputs();
    const feedInfo = helpers.parseFeedInfo(inputs.organization, inputs.feed);
    
    try {
        tl.debug(tl.loc('Debug_DownloadOperation', inputs.packageName, inputs.packageVersion, inputs.directory));

        // Set up packaging service endpoint
        const packagingLocation = await helpers.getPackagingLocation(feedInfo.serviceUri);

        tl.debug(tl.loc("Debug_UsingArtifactToolDownload"));

        const downloadOptions = {
            artifactToolPath,
            projectId: feedInfo.projectName,
            feedId: feedInfo.feedName,
            accountUrl: packagingLocation,
            packageName: inputs.packageName,
            packageVersion: inputs.packageVersion,
        } as helpers.artifactToolRunner.IArtifactToolOptions;

        downloadPackageUsingArtifactTool(inputs.directory, downloadOptions, authInfo.toolRunnerOptions);

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Success_PackagesDownloaded"));

    } catch (err) {
        helpers.handleTaskError(err, tl.loc('Error_PackagesFailedToDownload'), feedInfo);
    }
}

function downloadPackageUsingArtifactTool(downloadDir: string, options: helpers.artifactToolRunner.IArtifactToolOptions, execOptions: IExecOptions) {
    let command = new Array<string>();

    command.push("universal", "download",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", downloadDir,
        "--patvar", "UNIVERSAL_AUTH_TOKEN",
        "--verbosity", tl.getInput("verbosity"));

    if (options.projectId) {
        command.push("--project", options.projectId);
    }

    tl.debug(tl.loc("Debug_Downloading", options.packageName, options.packageVersion, options.feedId, options.projectId));
    const execResult: IExecSyncResult = helpers.artifactToolRunner.runArtifactTool(options.artifactToolPath, command, execOptions);
    if (execResult.code === 0) {
        return;
    }

    helpers.logCommandResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolDownload",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}


