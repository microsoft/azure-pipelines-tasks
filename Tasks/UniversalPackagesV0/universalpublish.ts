import * as pkgLocationUtils from "packaging-common/locationUtilities";
import {ProvenanceHelper} from "packaging-common/provenance";
import * as telemetry from "utility-common/telemetry";
import * as tl from "azure-pipelines-task-lib";
import {IExecOptions, IExecSyncResult} from "azure-pipelines-task-lib/toolrunner";
import * as artifactToolRunner from "packaging-common/universal/ArtifactToolRunner";
import * as artifactToolUtilities from "packaging-common/universal/ArtifactToolUtilities";
import * as auth from "packaging-common/universal/Authentication";

export async function run(artifactToolPath: string): Promise<void> {
    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;
    try {
        // Get directory to publish
        const publishDir: string = tl.getInput("publishDirectory");
        if (publishDir.length < 1)
        {
            tl.debug(tl.loc("Info_PublishDirectoryNotFound"));
            return;
        }

        let serviceUri: string;
        let feedId: string;
        let packageName: string;
        let version: string;
        let accessToken: string;
        let feedUri: string;
        const publishedPackageVar: string = tl.getInput("publishedPackageVar");
        const versionRadio = tl.getInput("versionPublishSelector");

        // Feed Auth
        let feedType = tl.getInput("internalOrExternalPublish") || "internal";

        const normalizedFeedType = ["internal", "external"].find((x) =>
            feedType.toUpperCase() === x.toUpperCase());
        if (!normalizedFeedType) {
            throw new Error(tl.loc("UnknownFeedType", feedType));
        }
        feedType = normalizedFeedType;

        let internalAuthInfo: auth.InternalAuthInfo;

        const toolRunnerOptions = artifactToolRunner.getOptions();

        let sessionId: string;

        if (feedType === "internal")
        {
            // getting inputs
            serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

            packageName = tl.getInput("packageListPublish");
            feedId = tl.getInput("feedListPublish");

            // Setting up auth info
            accessToken = pkgLocationUtils.getSystemAccessToken();
            internalAuthInfo = new auth.InternalAuthInfo([], accessToken);

            toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = internalAuthInfo.accessToken;

            let packagingLocation: string;
            try {
                // This call is to get the packaging URI(abc.pkgs.vs.com) which is same for all protocols.
                packagingLocation = await pkgLocationUtils.getNuGetUriFromBaseServiceUri(
                    serviceUri,
                    accessToken);
            } catch (error) {
                tl.debug(JSON.stringify(error));
                packagingLocation = serviceUri;
            }

            const pkgConn = pkgLocationUtils.getWebApiWithProxy(packagingLocation, accessToken);
            sessionId = await ProvenanceHelper.GetSessionId(
                feedId,
                "upack", /* must match protocol name on the server */
                pkgConn.serverUrl,
                [pkgConn.authHandler],
                pkgConn.options);
        }
        else {
            const externalAuthInfo = auth.GetExternalAuthInfo("externalEndpoints");
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
            toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = accessToken;
        }

        if (versionRadio === "custom"){
            version = tl.getInput("versionPublish");
        }
        else{
            feedUri = await pkgLocationUtils.getFeedUriFromBaseServiceUri(serviceUri, accessToken);

            const highestVersion = await artifactToolUtilities.getHighestPackageVersionFromFeed(
                feedUri,
                accessToken,
                feedId,
                packageName);

            version = artifactToolUtilities.getVersionUtility(tl.getInput("versionPublishSelector"), highestVersion);
        }
        tl.debug(tl.loc("Info_UsingArtifactToolPublish"));

        if (sessionId != null) {
            feedId = sessionId;
        }

        // tslint:disable-next-line:no-object-literal-type-assertion
        const publishOptions = {
            artifactToolPath,
            feedId,
            accountUrl: serviceUri,
            packageName,
            packageVersion: version,
        } as artifactToolRunner.IArtifactToolOptions;

        publishPackageUsingArtifactTool(publishDir, publishOptions, toolRunnerOptions);
        if(publishedPackageVar) {
            tl.setVariable(publishedPackageVar, `${packageName} ${version}`);
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

function publishPackageUsingArtifactTool(
    publishDir: string,
    options: artifactToolRunner.IArtifactToolOptions,
    execOptions: IExecOptions) {
    const command = new Array<string>();
    command.push("universal", "publish",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", publishDir,
        "--patvar", "UNIVERSAL_PUBLISH_PAT",
        "--verbosity", tl.getInput("verbosity"),
        "--description", tl.getInput("packagePublishDescription"));

    console.log(tl.loc("Info_Publishing", options.packageName, options.packageVersion, options.feedId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(
        options.artifactToolPath,
        command,
        execOptions);

    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactTool",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
