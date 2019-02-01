import { IExecSyncResult, IExecOptions } from "vsts-task-lib/toolrunner";
import * as artifactToolRunner from "packaging-common/universal/ArtifactToolRunner";
import * as tl from "vsts-task-lib";
import * as telemetry from "utility-common/telemetry";
import * as artifactToolUtilities from "packaging-common/universal/ArtifactToolUtilities";
import * as pkgLocationUtils from "packaging-common/locationUtilities";
import * as auth from "packaging-common/universal/Authentication";

export async function downloadUniversalPackage(
    downloadPath: string,
    feedId: string,
    packageId: string,
    version: string
): Promise<void> {
    try {
        const accessToken = pkgLocationUtils.getSystemAccessToken();
        let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        const blobUri = await pkgLocationUtils.getBlobstoreUriFromBaseServiceUri(serviceUri, accessToken);

        // Finding the artifact tool directory
        var artifactToolPath = await artifactToolUtilities.getArtifactToolFromService(
            blobUri,
            accessToken,
            "artifacttool"
        );

        const feedUri = await pkgLocationUtils.getFeedUriFromBaseServiceUri(serviceUri, accessToken);
        let packageName: string = await artifactToolUtilities.getPackageNameFromId(
            feedUri,
            accessToken,
            feedId,
            packageId
        );

        tl.debug(tl.loc("Info_UsingArtifactToolDownload"));

        const downloadOptions = {
            artifactToolPath,
            feedId,
            accountUrl: serviceUri,
            packageName,
            packageVersion: version
        } as artifactToolRunner.IArtifactToolOptions;

        let toolRunnerOptions = artifactToolRunner.getOptions();
        let internalAuthInfo: auth.InternalAuthInfo = new auth.InternalAuthInfo([], accessToken);
        toolRunnerOptions.env.UNIVERSAL_DOWNLOAD_PAT = internalAuthInfo.accessToken;
        downloadPackageUsingArtifactTool(downloadPath, downloadOptions, toolRunnerOptions);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
        return;
    } finally {
        _logUniversalStartupVariables(artifactToolPath);
    }
}

function downloadPackageUsingArtifactTool(
    downloadPath: string,
    options: artifactToolRunner.IArtifactToolOptions,
    execOptions: IExecOptions
) {
    let command = new Array<string>();

    command.push("universal", "download",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", downloadPath,
        "--patvar", "UNIVERSAL_DOWNLOAD_PAT",
        "--verbosity", tl.getInput("verbosity"));

    console.log(tl.loc("Info_Downloading", options.packageName, options.packageVersion, options.feedId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(
        options.artifactToolPath,
        command,
        execOptions
    );
    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(
        tl.loc(
            "Error_UnexpectedErrorArtifactToolDownload",
            execResult.code,
            execResult.stderr ? execResult.stderr.trim() : execResult.stderr
        )
    );
}

function _logUniversalStartupVariables(artifactToolPath: string) {
    try {
        let universalPackagesTelemetry = {
            command: tl.getInput("command"),
            buildProperties: tl.getInput("buildProperties"),
            basePath: tl.getInput("basePath"),
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            verbosity: tl.getInput("verbosity"),
            solution: tl.getInput("solution"),
            artifactToolPath: artifactToolPath
        };

        telemetry.emitTelemetry("Packaging", "UniversalPackages", universalPackagesTelemetry);
    } catch (err) {
        tl.debug(`Unable to log Universal Packages task init telemetry. Err:( ${err} )`);
    }
}
