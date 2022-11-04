import * as tl from "azure-pipelines-task-lib";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common-v3/locationUtilities";
import { getProjectAndFeedIdFromInputParam } from 'azure-pipelines-tasks-packaging-common-v3/util';
import { IExecSyncResult, IExecOptions } from "azure-pipelines-task-lib/toolrunner";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import * as artifactToolRunner from "azure-pipelines-tasks-packaging-common-v3/universal/ArtifactToolRunner";
import * as artifactToolUtilities from "azure-pipelines-tasks-packaging-common-v3/universal/ArtifactToolUtilities";
import * as auth from "azure-pipelines-tasks-packaging-common-v3/universal/Authentication";

export async function run(artifactToolPath: string): Promise<void> {
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    try {
        // Get directory where to download
        let downloadDir: string = tl.getInput("downloadDirectory");
        if (downloadDir.length < 1) {
            tl.warning(tl.loc("Info_DownloadDirectoryNotFound"));
            return;
        }

        let serviceUri: string;
        let feedId: string;
        let projectId: string;
        let packageName: string;
        let version: string;

        // Feed Auth
        let feedType = tl.getInput("internalOrExternalDownload") || "internal";

        const normalizedFeedType = ["internal", "external"].find((x) =>
            feedType.toUpperCase() === x.toUpperCase());
        if (!normalizedFeedType) {
            throw new Error(tl.loc("UnknownFeedType", feedType));
        }
        feedType = normalizedFeedType;

        let internalAuthInfo: auth.InternalAuthInfo;

        let toolRunnerOptions = artifactToolRunner.getOptions();

        if (feedType === "internal") {
            // getting inputs
            serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

            const feedProject = getProjectAndFeedIdFromInputParam("feedListDownload");
            feedId = feedProject.feedId;
            projectId = feedProject.projectId;

            // Getting package name from package Id
            const packageId = tl.getInput("packageListDownload");
            const accessToken = pkgLocationUtils.getSystemAccessToken();

            internalAuthInfo = new auth.InternalAuthInfo([], accessToken);

            const feedUri = await pkgLocationUtils.getFeedUriFromBaseServiceUri(serviceUri, accessToken);
            packageName = await artifactToolUtilities.getPackageNameFromId(feedUri, accessToken, projectId, feedId, packageId);

            version = tl.getInput("versionListDownload");

            toolRunnerOptions.env.UNIVERSAL_DOWNLOAD_PAT = internalAuthInfo.accessToken;
        }
        else {
            let externalAuthInfo = auth.GetExternalAuthInfo("externalEndpoint");

            if (!externalAuthInfo) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForDownload"));
                return;
            }

            serviceUri = externalAuthInfo.packageSource.accountUrl;
            const feedProject = getProjectAndFeedIdFromInputParam("feedDownloadExternal");
            feedId = feedProject.feedId;
            projectId = feedProject.projectId;

            packageName = tl.getInput("packageDownloadExternal");
            version = tl.getInput("versionDownloadExternal");

            // Assuming only auth via PAT works for now
            const tokenAuth = externalAuthInfo as auth.TokenExternalAuthInfo;
            toolRunnerOptions.env.UNIVERSAL_DOWNLOAD_PAT = tokenAuth.token;
        }

        tl.debug(tl.loc("Info_UsingArtifactToolDownload"));

        const downloadOptions = {
            artifactToolPath,
            projectId,
            feedId,
            accountUrl: serviceUri,
            packageName,
            packageVersion: version,
        } as artifactToolRunner.IArtifactToolOptions;

        downloadPackageUsingArtifactTool(downloadDir, downloadOptions, toolRunnerOptions);

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesDownloadedSuccessfully"));

    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToDownload"));
    }
}

function downloadPackageUsingArtifactTool(downloadDir: string, options: artifactToolRunner.IArtifactToolOptions, execOptions: IExecOptions) {

    let command = new Array<string>();

    command.push("universal", "download",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", downloadDir,
        "--patvar", "UNIVERSAL_DOWNLOAD_PAT",
        "--verbosity", tl.getInput("verbosity"));

    if (options.projectId) {
        command.push("--project", options.projectId);
    }

    console.log(tl.loc("Info_Downloading", options.packageName, options.packageVersion, options.feedId, options.projectId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(options.artifactToolPath, command, execOptions);
    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolDownload",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
