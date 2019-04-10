import { IExecSyncResult, IExecOptions } from "azure-pipelines-task-lib/toolrunner";
import * as artifactToolRunner from "packaging-common/universal/ArtifactToolRunner";
import * as tl from "azure-pipelines-task-lib";
import * as telemetry from "utility-common/telemetry";
import * as artifactToolUtilities from "packaging-common/universal/ArtifactToolUtilities";
import * as pkgLocationUtils from "packaging-common/locationUtilities";

export async function downloadUniversalPackage(
    downloadPath: string,
    feedId: string,
    packageId: string,
    version: string,
    filterPattern: string
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
        toolRunnerOptions.env.UNIVERSAL_DOWNLOAD_PAT = accessToken;
        downloadPackageUsingArtifactTool(downloadPath, downloadOptions, toolRunnerOptions, filterPattern);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
        return;
    } finally {
        _logUniversalStartupVariables({
            ArtifactToolPath: artifactToolPath,
            PackageType: "Universal",
            FeedId : feedId,
            PackageId: packageId,
            Version: version,
            IsTriggeringArtifact: tl.getInput("isTriggeringArtifact")
        });
    }
}

function downloadPackageUsingArtifactTool(
    downloadPath: string,
    options: artifactToolRunner.IArtifactToolOptions,
    execOptions: IExecOptions,
    filterPattern: string
) {
    let command = new Array<string>();
    var verbosity = tl.getVariable("Packaging.ArtifactTool.Verbosity") || "Error";
    
    command.push("universal", "download",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", downloadPath,
        "--patvar", "UNIVERSAL_DOWNLOAD_PAT",
        "--verbosity", verbosity,
        "--filter", filterPattern);

    console.log(tl.loc("Info_Downloading", options.packageName, options.packageVersion, options.feedId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(
        options.artifactToolPath,
        command,
        execOptions
    );
    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("DownloadPackage", "UniversalPackagesCommand", execResult.code);
    throw new Error(
        tl.loc(
            "Error_UnexpectedErrorArtifactToolDownload",
            execResult.code,
            execResult.stderr ? execResult.stderr.trim() : execResult.stderr
        )
    );
}

function _logUniversalStartupVariables(params: any) {
    try {
        telemetry.emitTelemetry("Packaging", "DownloadPackagev1", params);
    } catch (err) {
        tl.debug(`Unable to log Universal Packages task init telemetry. Err:( ${err} )`);
    }
}
