import * as tl from "vsts-task-lib";
import {IExecSyncResult, IExecOptions} from "vsts-task-lib/toolrunner";
import * as telemetry from "utility-common/telemetry";
import * as artifactToolRunner from "./Common/ArtifactToolRunner";
import * as artifactToolUtilities from "./Common/ArtifactToolUtilities";
import * as auth from "./Common/Authentication";

export async function run(artifactToolPath: string): Promise<void> {
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    try {
        // Get directory to publish
        let publishDir: string = tl.getInput("publishDirectory");
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

        let toolRunnerOptions = artifactToolRunner.getOptions();

        if (feedType === "internal")
        {
            // getting inputs
            serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

            packageName = tl.getInput("packageListPublish");
            feedId = tl.getInput("feedListPublish");
            // Setting up auth info
            accessToken = auth.getSystemAccessToken();
            internalAuthInfo = new auth.InternalAuthInfo([], accessToken);

            toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = internalAuthInfo.accessToken;
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
        } as artifactToolRunner.IArtifactToolOptions;

        publishPackageUsingArtifactTool(publishDir, publishOptions, toolRunnerOptions);

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesPublishedSuccessfully"));
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToPublish"));
    }
}

function publishPackageUsingArtifactTool(publishDir: string, options: artifactToolRunner.IArtifactToolOptions, execOptions: IExecOptions) {
    let command = new Array<string>();
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
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(options.artifactToolPath, command, execOptions);

    if (execResult.code === 0) {
        return;
    }

    telemetry.logResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactTool",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}
