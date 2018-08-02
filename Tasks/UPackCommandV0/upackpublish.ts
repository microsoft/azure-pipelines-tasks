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
        let publishDir: string = tl.getInput("publishDirectory");
        if (publishDir.length < 1)
        {
            tl.debug(tl.loc("Info_NoPackagesMatchedTheSearchPattern"));
            return;
        }

        let serviceUri: string;
        let feedId: string;
        let packageName: string;
        let version: string;
        let accessToken: string;
        let feedUri: string;
        const versionRadio = tl.getInput("versionPublishSelector");

        // Feed Auth
        let uPackFeedType = tl.getInput("internalOrExternalPublish") || "internal";

        const normalizedUPackFeedType = ["internal", "external"].find((x) =>
            uPackFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedUPackFeedType) {
            throw new Error(tl.loc("UnknownFeedType", uPackFeedType));
        }
        uPackFeedType = normalizedUPackFeedType;

        let internalAuthInfo: auth.InternalAuthInfo;

        let authInfo: auth.UPackExtendedAuthInfo;

        if (uPackFeedType === "internal")
        {
            // getting inputs
            serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

            packageName = tl.getInput("packageListPublish");
            feedId = tl.getInput("feedListPublish");
            // Setting up auth info
            accessToken = auth.getSystemAccessToken();
            internalAuthInfo = new auth.InternalAuthInfo([], accessToken);

            authInfo = new auth.UPackExtendedAuthInfo(internalAuthInfo);
            process.env.UPACK_PUBLISH_PAT = internalAuthInfo.accessToken;
        }
        else {
            const externalAuthInfo = auth.GetExternalAuthInfo("externalEndpoints");
            authInfo = new auth.UPackExtendedAuthInfo(internalAuthInfo, externalAuthInfo);
            if (!externalAuthInfo)
            {
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForPublish"));
                return;
            }

            serviceUri = externalAuthInfo.packageSource.accountUrl;

            feedId = tl.getInput("feedPublishExternal");
            packageName = tl.getInput("packagePublishExternal");

            // Assuming only auth via PAT works for now
            accessToken = (externalAuthInfo as auth.TokenExternalAuthInfo).token;

            process.env.UPACK_PUBLISH_PAT = accessToken;
        }

        try {
            if (versionRadio === "custom"){
                version = tl.getInput("versionPublish");
            }
            else{
                feedUri = await artifactToolUtilities.getFeedUriFromBaseServiceUri(serviceUri, accessToken);

                let highestVersion = await artifactToolUtilities.getHighestPackageVersionFromFeed(feedUri, accessToken, feedId, packageName);

                version = artifactToolUtilities.getVersionUtility(tl.getInput("versionPublishSelector"), highestVersion);
            }
            tl.debug(tl.loc("Info_UsingArtifactToolPublish"));

            // tslint:disable-next-line:no-object-literal-type-assertion
            const publishOptions = {
                artifactToolPath,
                feedId,
                accountUrl: serviceUri,
                packageName,
                packageVersion: version,
                authInfo,
            } as artifactToolRunner.IArtifactToolOptions;

            publishPackageUsingArtifactTool(publishDir, publishOptions);
        } finally {
            process.env.UPACK_PUBLISH_PAT = "";
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesPublishedSuccessfully"));
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToPublish"));
    }
}

function publishPackageUsingArtifactTool(publishDir: string, options: artifactToolRunner.IArtifactToolOptions) {
    let command = new Array<string>();

    command.push("upack", "publish",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", publishDir,
        "--patvar", "UPACK_PUBLISH_PAT",
        "--verbosity", tl.getInput("verbosity"),
        "--description", tl.getInput("packagePublishDescription"));

    console.log(tl.loc("Info_Publishing", options.packageName, options.packageVersion, options.feedId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(options.artifactToolPath, command);

    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("Packaging", "UPackCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactTool",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
