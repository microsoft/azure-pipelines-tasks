import * as path from "path";
import * as Q  from "q";
import * as tl from "azure-pipelines-task-lib/task";

import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import INuGetCommandOptions from "azure-pipelines-tasks-packaging-common/nuget/INuGetCommandOptions";
import {NuGetConfigHelper} from "azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper";
import * as ngToolGetter from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter";
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import { logError } from 'azure-pipelines-tasks-packaging-common/util';

class PublishOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public feedUri: string,
        public apiKey: string,
        public configFile: string,
        public verbosity: string,
        public extraArgs: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings
    ) { }
}

async function main(): Promise<void> {
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug("Unable to get packaging URIs");
        logError(error);
        throw error;
    }

    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    try {
        tl.setResourcePath(path.join(__dirname, "task.json"));

        nutil.setConsoleCodePage();

        // read inputs
        let searchPattern = tl.getPathInput("searchPattern", true, false);
        let allowEmptyNupkgMatch = tl.getBoolInput("continueOnEmptyNupkgMatch");
        let filesList = nutil.resolveFilterSpec(
            searchPattern,
            tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(),
            allowEmptyNupkgMatch);
        filesList.forEach(packageFile => {
            if (!tl.stats(packageFile).isFile()) {
                throw new Error(tl.loc("NotARegularFile", packageFile));
            }
        });

        let connectedServiceName = tl.getInput("connectedServiceName");
        let internalFeedUri = tl.getInput("feedName");
        let nuGetAdditionalArgs = tl.getInput("nuGetAdditionalArgs");
        let verbosity = tl.getInput("verbosity");

        let nuGetFeedType = tl.getInput("nuGetFeedType") || "external";
        // make sure the feed type is an expected one
        let normalizedNuGetFeedType
            = ["internal", "external"].find(x => nuGetFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc("UnknownFeedType", nuGetFeedType));
        }

        nuGetFeedType = normalizedNuGetFeedType;

        // due to a bug where we accidentally allowed nuGetPath to be surrounded by quotes before,
        // locateNuGetExe() will strip them and check for existence there.
        let nuGetPath = tl.getPathInput("nuGetPath", false, false);
        let nugetUxOption = tl.getInput("nuGetversion");
        let userNuGetProvided = false;
        if (nuGetPath !== undefined && tl.filePathSupplied("nuGetPath")) {
            nuGetPath = nutil.stripLeadingAndTrailingQuotes(nuGetPath);
            userNuGetProvided = true;
            if (nugetUxOption !== "custom")
            {
                // For back compat, if a path has already been specified then use it.
                // However, warn the user in the build of this behavior.
                tl.warning(tl.loc("Warning_ConflictingNuGetPreference"));
            }
        }
        else {
            if (nugetUxOption === "custom")
            {
                throw new Error(tl.loc("NoNuGetSpecified"))
            }
            // Pull the pre-installed path for NuGet.
            let nuGetPathSuffix: string;
            let versionToUse: string;
            if (nugetUxOption === "4.0.0.2283") {
                nuGetPathSuffix = "NuGet/4.0.0/";
                versionToUse = "4.0.0";
            }
            else if (nugetUxOption === "3.5.0.1829") {
                nuGetPathSuffix = "NuGet/3.5.0/";
                versionToUse = "3.5.0";
            }
            else if (nugetUxOption === "3.3.0") {
                nuGetPathSuffix = "NuGet/3.3.0/";
                versionToUse = "3.3.0";
            }
            else {
                throw new Error(tl.loc("NGCommon_UnabletoDetectNuGetVersion"));
            }

            // save and reset the tool path env var, so this task doesn't act as a tool installer
            const tempNuGetPath = tl.getVariable(ngToolGetter.NUGET_EXE_TOOL_PATH_ENV_VAR);
            const cachedVersion = await ngToolGetter.cacheBundledNuGet(versionToUse, nuGetPathSuffix);
            nuGetPath = await ngToolGetter.getNuGet(cachedVersion);
            tl.setVariable(ngToolGetter.NUGET_EXE_TOOL_PATH_ENV_VAR, tempNuGetPath);
        }

        //find nuget location to use
        let credProviderPath = nutil.locateCredentialProvider();

        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);

        // clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
        const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;

        let accessToken = pkgLocationUtils.getSystemAccessToken();
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`all URL prefixes: ${urlPrefixes}`);
        }

        const authInfo = new auth.NuGetAuthInfo(urlPrefixes, accessToken);
        let environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            authInfo: authInfo,
            credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
            extensionsDisabled: !userNuGetProvided
        }

        let configFile = null;
        let apiKey: string;
        let feedUri: string;
        let credCleanup = () => { return };
        if (nuGetFeedType == "internal") {
            if (useCredConfig) {
                let nuGetConfigHelper = new NuGetConfigHelper(nuGetPath, null, authInfo, environmentSettings);
                nuGetConfigHelper.setSources([{ feedName: "internalFeed", feedUri: internalFeedUri }], true);
                configFile = nuGetConfigHelper.tempNugetConfigPath;
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
            }

            apiKey = "VSTS";
            feedUri = internalFeedUri;
        }
        else {
            feedUri = tl.getEndpointUrl(connectedServiceName, false);
            let externalAuth = tl.getEndpointAuthorization(connectedServiceName, false);
            apiKey = externalAuth.parameters["password"];
        }

        try {
            let publishOptions = new PublishOptions(
                nuGetPath,
                feedUri,
                apiKey,
                configFile,
                verbosity,
                nuGetAdditionalArgs,
                environmentSettings);

            for (const packageFile of filesList) {
                await publishPackageAsync(packageFile, publishOptions);
            }
        } finally {
            credCleanup();
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

main();

function publishPackageAsync(packageFile: string, options: PublishOptions): Q.Promise<number> {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment);
    nugetTool.arg("push");

    nugetTool.arg("-NonInteractive");

    nugetTool.arg(packageFile);

    nugetTool.arg(["-Source", options.feedUri]);

    nugetTool.argIf(options.apiKey, ["-ApiKey", options.apiKey]);

    if (options.configFile) {
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(options.configFile);
    }

    if (options.verbosity && options.verbosity !== "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    if (options.extraArgs) {
        nugetTool.line(options.extraArgs);
    }

    return nugetTool.exec();
}
