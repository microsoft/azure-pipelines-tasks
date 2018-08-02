import * as tl from "vsts-task-lib/task";
import {IExecSyncResult} from "vsts-task-lib/toolrunner";

import * as telemetry from "utility-common/telemetry";
import * as artifactToolRunner from "./Common/ArtifactToolRunner";
import * as artifactToolUtilities from "./Common/ArtifactToolUtilities";
import * as auth from "./Common/Authentication";

export async function run(artifactToolPath: string): Promise<void> {
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    try {
        artifactToolUtilities.setConsoleCodePage();

        // Get directory to publish
        let downloadDir: string = tl.getInput("downloadDirectory");
        if (downloadDir.length < 1)
        {
            //todo
            tl.warning(tl.loc("Info_NoPackagesMatchedTheSearchPattern"));
            return;
        }

        let serviceUri: string;
        let feedId: string;
        let packageName: string;
        let version: string;

        // Feed Auth
        let uPackFeedType = tl.getInput("internalOrExternalDownload") || "internal";

        const normalizedUPackFeedType = ["internal", "external"].find((x) =>
            uPackFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedUPackFeedType) {
            throw new Error(tl.loc("UnknownFeedType", uPackFeedType));
        }
        uPackFeedType = normalizedUPackFeedType;

        let authInfo: auth.UPackExtendedAuthInfo;
        let internalAuthInfo: auth.InternalAuthInfo;

        if (uPackFeedType === "internal")
        {
            // getting inputs
            serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

            feedId = tl.getInput("feedListDownload");

            // Getting package name from package Id
            const packageId = tl.getInput("packageListDownload");
            const accessToken = auth.getSystemAccessToken();

            internalAuthInfo = new auth.InternalAuthInfo([], accessToken);

            const feedUri = await artifactToolUtilities.getFeedUriFromBaseServiceUri(serviceUri, accessToken);
            packageName = await artifactToolUtilities.getPackageNameFromId(feedUri, accessToken, feedId, packageId);

            version = tl.getInput("versionListDownload");
            authInfo = new auth.UPackExtendedAuthInfo(internalAuthInfo);

            process.env.UPACK_DOWNLOAD_PAT = internalAuthInfo.accessToken;
        }
        else {
            let externalAuthInfo = auth.GetExternalAuthInfo("externalEndpoint");
            authInfo = new auth.UPackExtendedAuthInfo(internalAuthInfo, externalAuthInfo);

            if (!externalAuthInfo)
            {
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForDownload"));
                return;
            }

            serviceUri = externalAuthInfo.packageSource.accountUrl;
            feedId = tl.getInput("feedDownloadExternal");
            packageName = tl.getInput("packageDownloadExternal");
            version = tl.getInput("versionDownloadExternal");

            // Assuming only auth via PAT works for now
            const tokenAuth = externalAuthInfo as auth.TokenExternalAuthInfo;
            process.env.UPACK_DOWNLOAD_PAT = tokenAuth.token;
        }
        try {
            tl.debug(tl.loc("Info_UsingArtifactToolDownload"));

            const downloadOptions = {
                artifactToolPath,
                feedId,
                accountUrl: serviceUri,
                packageName,
                packageVersion: version,
                authInfo: authInfo,
            } as artifactToolRunner.IArtifactToolOptions;

            downloadPackageUsingArtifactTool(downloadDir, downloadOptions);
        } finally {
            process.env.UPACK_DOWNLOAD_PAT = "";
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesDownloadedSuccessfully"));
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToDownload"));
    }
}

function downloadPackageUsingArtifactTool(downloadDir: string, options: artifactToolRunner.IArtifactToolOptions) {

    let command = new Array<string>();

    command.push("upack", "download",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", downloadDir,
        "--patvar", "UPACK_DOWNLOAD_PAT",
        "--verbosity", tl.getInput("verbosity"));

    console.log(tl.loc("Info_Downloading", options.packageName, options.packageVersion, options.feedId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(options.artifactToolPath, command);
    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("Packaging", "UPackCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactToolDownload",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
