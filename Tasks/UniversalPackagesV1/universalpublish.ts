import * as pkgLocationUtils from "packaging-common/locationUtilities";
import {ProvenanceHelper} from "packaging-common/provenance";
import { getProjectAndFeedIdFromInputParam } from 'packaging-common/util';
import * as telemetry from "utility-common/telemetry";
import * as tl from "azure-pipelines-task-lib";
import {IExecOptions, IExecSyncResult} from "azure-pipelines-task-lib/toolrunner";
import * as artifactToolRunner from "packaging-common/universal/ArtifactToolRunner";
import * as artifactToolUtilities from "packaging-common/universal/ArtifactToolUtilities";
import * as auth from "packaging-common/universal/Authentication";
import { logError } from 'packaging-common/util';
import fs = require('fs');
import * as path from 'path';

const packageAlreadyExistsError = 17;
const numRetries = 1;

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
        let fileInputPublish = tl.getBoolInput("fileInputPublish", false);
        
        if(fileInputPublish)
        {
            // parse the input file 
            let pathToInputJsonFile = tl.getPathInput("pathToInputJsonFile", true, true);
            
            if(!tl.exist(pathToInputJsonFile)) {
                tl.warning(`'${pathToInputJsonFile}' doesn't exist`);
                return;
            }

            let packageObjectArray = JSON.parse(fs.readFileSync(pathToInputJsonFile, 'utf-8'));

            if (packageObjectArray.length === 0) {
                tl.warning(`No Universal packages were found in the config file '${pathToInputJsonFile}'`);
                return;
            }

            tl.debug(tl.loc("Info_PackagesCount: " + packageObjectArray.length));

            packageObjectArray.forEach(packageObject => {
                publishUniversalPackage(
                    artifactToolPath,
                    packageObject.PackageName, 
                    packageObject.Project,
                    packageObject.Feed,
                    path.join(publishDir, packageObject.PathFromPublishDirectory),
                    "internal",
                    fetchAuthToken("internal"),
                    tl.getVariable("System.CollectionUri"),
                    fileInputPublish,
                    packageObject.PackageVersion
                );
            });

        }
        else {
            let serviceUri: string;
            let feedId: string;
            let projectId: string;
            let packageName: string;
            let accessToken: string;
            const versionRadio = tl.getInput("versionPublishSelector");
    
            // Feed Auth
            let feedType = tl.getInput("internalOrExternalPublish") || "internal";
    
            const normalizedFeedType = ["internal", "external"].find((x) =>
                feedType.toUpperCase() === x.toUpperCase());
            if (!normalizedFeedType) {
                throw new Error(tl.loc("UnknownFeedType", feedType));
            }
            feedType = normalizedFeedType;
    
            accessToken = fetchAuthToken(feedType);
            [serviceUri, packageName, feedId, projectId, accessToken] = fetchPublishParams(feedType);

            let version: string;
            let feedUri: string;

            if (versionRadio === "custom"){
                version = tl.getInput("versionPublish");
            }
            else{
                feedUri = await pkgLocationUtils.getFeedUriFromBaseServiceUri(serviceUri, accessToken);
                version = await getNextPackageVersion(feedUri, accessToken, projectId, feedId, packageName);
            }

            publishUniversalPackage(artifactToolPath, packageName, projectId, feedId, publishDir, feedType, accessToken, serviceUri, fileInputPublish, version, versionRadio);
        }

        
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
    command.push(
        "universal", "publish",
        "--feed", options.feedId,
        "--service", options.accountUrl,
        "--package-name", options.packageName,
        "--package-version", options.packageVersion,
        "--path", publishDir,
        "--patvar", "UNIVERSAL_PUBLISH_PAT",
        "--verbosity", tl.getInput("verbosity"),
        "--description", tl.getInput("packagePublishDescription"));

    if (options.projectId) {
        command.push("--project", options.projectId);
    }

    console.log(tl.loc("Info_Publishing", options.packageName, options.packageVersion, options.feedId, options.projectId));
    const execResult: IExecSyncResult = artifactToolRunner.runArtifactTool(
        options.artifactToolPath,
        command,
        execOptions);

    if (execResult.code === 0) {
        return;
    }

    //Retry if package exist error occurs
    if (execResult.code == packageAlreadyExistsError) {
        return execResult.code;
    }

    telemetry.logResult("Packaging", "UniversalPackagesCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorArtifactTool",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}

async function getNextPackageVersion(
    feedUri: string,
    accessToken: string,
    projectId: string,
    feedId: string,
    packageName: string)  {
    let version: string;
    const highestVersion = await artifactToolUtilities.getHighestPackageVersionFromFeed(
        feedUri,
        accessToken,
        projectId,
        feedId,
        packageName);
    
    if(highestVersion != null) {
         version= artifactToolUtilities.getVersionUtility(tl.getInput("versionPublishSelector"), highestVersion);
    }            

    if(version == null) {
        throw new Error(tl.loc("FailedToGetLatestPackageVersion"));
    }

    return version;
}

function fetchAuthToken(feedType: string) {
    let accessToken: string;
    
    if (feedType == "internal") {

        // Setting up auth info
        accessToken = pkgLocationUtils.getSystemAccessToken();
    }

    else {
        const externalAuthInfo = auth.GetExternalAuthInfo("externalEndpoints");
        if (!externalAuthInfo)  {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForPublish"));
            return;
        }

        // Assuming only auth via PAT works for now
        accessToken = (externalAuthInfo as auth.TokenExternalAuthInfo).token;
    }
    return accessToken;
}

function fetchPublishParams(
    feedType: string
)   {

    let serviceUri: string;
    let packageName: string;
    let feedId: string;
    let projectId: string;

    if (feedType == "internal") {
        
        // getting inputs
        serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

        packageName = tl.getInput("packageListPublish");
        const feedProject = getProjectAndFeedIdFromInputParam("feedListPublish");
        feedId = feedProject.feedId;
        projectId = feedProject.projectId;
    }

    else {
        const externalAuthInfo = auth.GetExternalAuthInfo("externalEndpoints");
        if (!externalAuthInfo)  {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForPublish"));
            return;
        }

        serviceUri = externalAuthInfo.packageSource.accountUrl;

        const feedProject = getProjectAndFeedIdFromInputParam("feedPublishExternal");
        feedId = feedProject.feedId;
        projectId = feedProject.projectId;

        packageName = tl.getInput("packagePublishExternal");
    }
    return [
        serviceUri, 
        packageName,
        feedId,
        projectId
    ];
}

async function publishUniversalPackage(artifactToolPath: string, packageName: string, project: string, feed: string, path: string, feedType: string, accessToken: string, serviceUri: string, fileInputPublish: boolean, packageVersion: string, versionRadio?: string) {
    const toolRunnerOptions = artifactToolRunner.getOptions();
    let sessionId: string;
    let internalAuthInfo: auth.InternalAuthInfo;
    let publishStatus: number;

    if (feedType === "internal")
    {
        internalAuthInfo = new auth.InternalAuthInfo([], accessToken);
        toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = internalAuthInfo.accessToken;
        let packagingLocation: string;
        try {
            // This call is to get the packaging URI(abc.pkgs.vs.com) which is same for all protocols.
            packagingLocation = await pkgLocationUtils.getNuGetUriFromBaseServiceUri(
                serviceUri,
                accessToken);
        } catch (error) {
            logError(error);
            packagingLocation = serviceUri;
        }
        const pkgConn = pkgLocationUtils.getWebApiWithProxy(packagingLocation, accessToken);
        sessionId = await ProvenanceHelper.GetSessionId(
            feed,
            project,
            "upack", /* must match protocol name on the server */
            pkgConn.serverUrl,
            [pkgConn.authHandler],
            pkgConn.options);
    }
    else {
        //Catch the no external point error
        if (!serviceUri) {
            return
        }
        toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = accessToken;
    }


    tl.debug(tl.loc("Info_UsingArtifactToolPublish"));
    if (sessionId != null) {
        feed = sessionId;
    }

    var retries = 0;
    let newVersion: string = packageVersion;
    let feedUri: string;

    //If package already exist, retry with a newer version, do not retry for custom version
    do {
        const publishOptions = {
            artifactToolPath,
            projectId: project,
            feedId: feed,
            accountUrl: serviceUri,
            packageName,
            packageVersion: newVersion,
        } as artifactToolRunner.IArtifactToolOptions;
        tl.debug(tl.loc("Info_PublishingRetry", publishOptions.packageName, newVersion));
        publishStatus = publishPackageUsingArtifactTool(path, publishOptions, toolRunnerOptions);

        if(publishStatus === 0) {
            break; // successful
        }

        accessToken = fetchAuthToken(feedType);

        if (feedType == "internal") {
            internalAuthInfo = new auth.InternalAuthInfo([], accessToken);
            toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = internalAuthInfo.accessToken;
        }
        else {
            toolRunnerOptions.env.UNIVERSAL_PUBLISH_PAT = accessToken;
        }

        feedUri = await pkgLocationUtils.getFeedUriFromBaseServiceUri(serviceUri, accessToken);
        newVersion = await getNextPackageVersion(feedUri, accessToken, project, feed, packageName);
        retries++; 
    } while (retries < numRetries && publishStatus != null && publishStatus === packageAlreadyExistsError && versionRadio && versionRadio !== "custom");

    const publishedPackageVar: string = tl.getInput("publishedPackageVar");
    if(publishedPackageVar) {
        tl.setVariable(publishedPackageVar, `${packageName} ${newVersion}`);
    }

    tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesPublishedSuccessfully"));
    
}
