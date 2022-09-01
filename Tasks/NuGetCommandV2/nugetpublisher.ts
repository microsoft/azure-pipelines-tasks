import * as tl from "azure-pipelines-task-lib/task";
import {IExecSyncResult} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "packaging-common/nuget/Authentication";
import * as commandHelper from "packaging-common/nuget/CommandHelper";
import {NuGetConfigHelper2} from "packaging-common/nuget/NuGetConfigHelper2";
import * as ngToolRunner from "packaging-common/nuget/NuGetToolRunner2";
import peParser = require("packaging-common/pe-parser/index");
import {VersionInfo} from "packaging-common/pe-parser/VersionResource";
import * as nutil from "packaging-common/nuget/Utility";
import * as pkgLocationUtils from "packaging-common/locationUtilities";
import * as telemetry from "utility-common-v2/telemetry";
import INuGetCommandOptions from "packaging-common/nuget/INuGetCommandOptions2";
import * as vstsNuGetPushToolRunner from "./Common/VstsNuGetPushToolRunner";
import * as vstsNuGetPushToolUtilities from "./Common/VstsNuGetPushToolUtilities";
import { getProjectAndFeedIdFromInputParam } from 'packaging-common/util';
import { logError } from 'packaging-common/util';

class PublishOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public feedUri: string,
        public apiKey: string,
        public configFile: string,
        public verbosity: string,
        public authInfo: auth.NuGetExtendedAuthInfo,
        public environment: ngToolRunner.NuGetEnvironmentSettings)
    { }
}

interface IVstsNuGetPushOptions {
    vstsNuGetPushPath: string;
    feedUri: string;
    internalAuthInfo: auth.InternalAuthInfo;
    verbosity: string;
    settings: vstsNuGetPushToolRunner.VstsNuGetPushSettings;
}

export async function run(nuGetPath: string): Promise<void> {
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug("Unable to get packaging URIs");
        logError(error);
        throw error;
    }

    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;
    try {
        nutil.setConsoleCodePage();

        // Get list of files to pusblish
        const searchPatternInput = tl.getPathInput("searchPatternPush", true, false);

        const useLegacyFind: boolean = tl.getVariable("NuGet.UseLegacyFindFiles") === "true";
        let filesList: string[] = [];
        if (!useLegacyFind) {
            const findOptions: tl.FindOptions = {} as tl.FindOptions;
            const matchOptions: tl.MatchOptions = {} as tl.MatchOptions;
            const searchPatterns: string[] = nutil.getPatternsArrayFromInput(searchPatternInput);
            filesList = tl.findMatch(undefined, searchPatterns, findOptions, matchOptions);
        }
        else {
            filesList = nutil.resolveFilterSpec(searchPatternInput);
        }

        filesList.forEach((packageFile) => {
            if (!tl.stats(packageFile).isFile()) {
                throw new Error(tl.loc("Error_PushNotARegularFile", packageFile));
            }
        });

        if (filesList && filesList.length < 1)
        {
            tl.warning(tl.loc("Info_NoPackagesMatchedTheSearchPattern"));
            return;
        }

        // Get the info the type of feed
        let nugetFeedType = tl.getInput("nuGetFeedType") || "internal";
        // Make sure the feed type is an expected one
        const normalizedNuGetFeedType = ["internal", "external"]
            .find((x) => nugetFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc("UnknownFeedType", nugetFeedType));
        }
        nugetFeedType = normalizedNuGetFeedType;

        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`all URL prefixes: ${urlPrefixes}`);
        }

        // Setting up auth info
        const accessToken = pkgLocationUtils.getSystemAccessToken();
        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);

        // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const useV1CredProvider: boolean = ngToolRunner.isCredentialProviderEnabled(quirks);
        const useV2CredProvider: boolean = ngToolRunner.isCredentialProviderV2Enabled(quirks);
        const credProviderPath: string = nutil.locateCredentialProvider(useV2CredProvider);
        const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks)
                                && (!useV1CredProvider && !useV2CredProvider);

        const internalAuthInfo = new auth.InternalAuthInfo(
            urlPrefixes,
            accessToken,
            ((useV1CredProvider || useV2CredProvider) ? credProviderPath : null),
            useCredConfig);

        const environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: useV2CredProvider === false ? credProviderPath : null,
            V2CredProviderPath: useV2CredProvider === true ? credProviderPath : null,
            extensionsDisabled: true,
        };

        let configFile = null;
        let apiKey: string;
        let credCleanup = () => { return; };

        let feedUri: string;
        const isInternalFeed: boolean = nugetFeedType === "internal";

        let authInfo: auth.NuGetExtendedAuthInfo;
        let nuGetConfigHelper: NuGetConfigHelper2;

        if (isInternalFeed)
        {
            authInfo = new auth.NuGetExtendedAuthInfo(internalAuthInfo);
            nuGetConfigHelper = new NuGetConfigHelper2(nuGetPath, null, authInfo, environmentSettings, null);
            const feed = getProjectAndFeedIdFromInputParam('feedPublish');
            const nuGetVersion: VersionInfo = await peParser.getFileVersionInfoAsync(nuGetPath);
            feedUri = await nutil.getNuGetFeedRegistryUrl(
                packagingLocation.DefaultPackagingUri,
                feed.feedId,
                feed.projectId,
                nuGetVersion,
                accessToken,
                true /* useSession */);
            if (useCredConfig) {
                nuGetConfigHelper.addSourcesToTempNuGetConfig([
                    // tslint:disable-next-line:no-object-literal-type-assertion
                    {
                        feedName: feed.feedId,
                        feedUri,
                        isInternal: true,
                    } as auth.IPackageSource]);
                configFile = nuGetConfigHelper.tempNugetConfigPath;
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
            }

            apiKey = "VSTS";
        } else {
            const externalAuthArr = commandHelper.GetExternalAuthInfoArray("externalEndpoint");
            authInfo = new auth.NuGetExtendedAuthInfo(internalAuthInfo, externalAuthArr);
            nuGetConfigHelper = new NuGetConfigHelper2(nuGetPath, null, authInfo, environmentSettings, null);

            const externalAuth = externalAuthArr[0];

            if (!externalAuth)
            {
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForPush"));
                return;
            }

            nuGetConfigHelper.addSourcesToTempNuGetConfig([externalAuth.packageSource]);
            feedUri = externalAuth.packageSource.feedUri;
            configFile = nuGetConfigHelper.tempNugetConfigPath;
            credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);

            const authType: auth.ExternalAuthType = externalAuth.authType;
            switch(authType) {
                case (auth.ExternalAuthType.UsernamePassword):
                case (auth.ExternalAuthType.Token):
                    apiKey = "RequiredApiKey";
                    break;
                case (auth.ExternalAuthType.ApiKey):
                    const apiKeyAuthInfo =  externalAuth as auth.ApiKeyExternalAuthInfo;
                    apiKey = apiKeyAuthInfo.apiKey;
                    break;
                default:
                    break;
            }
        }

        if (isInternalFeed === false || useCredConfig) {
            nuGetConfigHelper.setAuthForSourcesInTempNuGetConfig();
        }

        environmentSettings.registryUri = feedUri;

        const verbosity = tl.getInput("verbosityPush");

        const continueOnConflict: boolean = tl.getBoolInput("allowPackageConflicts");
        const useVstsNuGetPush = shouldUseVstsNuGetPush(isInternalFeed, continueOnConflict, nuGetPath);
        let vstsPushPath: string;
        if (useVstsNuGetPush) {
            vstsPushPath = vstsNuGetPushToolUtilities.getBundledVstsNuGetPushLocation();

            if (!vstsPushPath)
            {
                tl.warning(tl.loc("Warning_FallBackToNuGet"));
            }
        }

        try {
            if (useVstsNuGetPush && vstsPushPath) {
                tl.debug("Using VstsNuGetPush.exe to push the packages");
                const vstsNuGetPushSettings: vstsNuGetPushToolRunner.VstsNuGetPushSettings =
                {
                    continueOnConflict,
                };

                const publishOptions: IVstsNuGetPushOptions = {
                    vstsNuGetPushPath: vstsPushPath,
                    feedUri,
                    internalAuthInfo: authInfo.internalAuthInfo,
                    verbosity,
                    settings: vstsNuGetPushSettings,
                };

                for (const packageFile of filesList) {
                    publishPackageVstsNuGetPush(packageFile, publishOptions);
                }
            }
            else {
                tl.debug("Using NuGet.exe to push the packages");           
                const publishOptions = new PublishOptions(
                    nuGetPath,
                    feedUri,
                    apiKey,
                    configFile,
                    verbosity,
                    authInfo,
                    environmentSettings);

                for (const packageFile of filesList) {
                    publishPackageNuGet(packageFile, publishOptions, authInfo, continueOnConflict);
                }
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

function publishPackageNuGet(
    packageFile: string,
    options: PublishOptions,
    authInfo: auth.NuGetExtendedAuthInfo,
    continueOnConflict: boolean)
    : IExecSyncResult {
    const nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment, authInfo);

    nugetTool.arg("push");

    nugetTool.arg(packageFile);

    nugetTool.arg("-NonInteractive");

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

    const execResult = nugetTool.execSync();
    if (execResult.code !== 0) {
        telemetry.logResult("Packaging", "NuGetCommand", execResult.code);
        if(continueOnConflict && execResult.stderr.indexOf("The feed already contains")>0){
            tl.debug(`A conflict occurred with package ${packageFile}, ignoring it since "Allow duplicates" was selected.`);
            return {
                code: 0,
                stdout: execResult.stderr,
                stderr: null,
                error: null
            };
        } else {
            throw tl.loc("Error_NugetFailedWithCodeAndErr",
                execResult.code,
                execResult.stderr ? execResult.stderr.trim() : execResult.stderr);
        }
    }
    return execResult;
}

function publishPackageVstsNuGetPush(packageFile: string, options: IVstsNuGetPushOptions) {
    const vstsNuGetPushTool = vstsNuGetPushToolRunner.createVstsNuGetPushToolRunner(
        options.vstsNuGetPushPath,
        options.settings,
        options.internalAuthInfo);
    vstsNuGetPushTool.arg(packageFile);
    vstsNuGetPushTool.arg(["-Source", options.feedUri]);
    vstsNuGetPushTool.arg(["-AccessToken", options.internalAuthInfo.accessToken]);
    vstsNuGetPushTool.arg("-NonInteractive");

    if (options.verbosity && options.verbosity.toLowerCase() === "detailed") {
        vstsNuGetPushTool.arg(["-Verbosity", "Detailed"]);
    }

    const execResult: IExecSyncResult = vstsNuGetPushTool.execSync();
    if (execResult.code === 0) {
        return;
    }

    // ExitCode 2 means a push conflict occurred
    if (execResult.code === 2 && options.settings.continueOnConflict) {
        tl.debug(`A conflict occurred with package ${packageFile}, ignoring it since "Allow duplicates" was selected.`);
        return;
    }

    telemetry.logResult("Packaging", "NuGetCommand", execResult.code);
    throw new Error(tl.loc("Error_UnexpectedErrorVstsNuGetPush",
        execResult.code,
        execResult.stderr ? execResult.stderr.trim() : execResult.stderr));
}

function shouldUseVstsNuGetPush(isInternalFeed: boolean, conflictsAllowed: boolean, nugetExePath: string): boolean {
    if (tl.osType() !== "Windows_NT"){
        tl.debug("Running on a non-windows platform so NuGet.exe will be used.");
        return false;
    }

    if (!isInternalFeed)
    {
        tl.debug("Pushing to an external feed so NuGet.exe will be used.");
        return false;
    }

    if (commandHelper.isOnPremisesTfs())
    {
        tl.debug("Pushing to an onPrem environment, only NuGet.exe is supported.");
        if(conflictsAllowed){
            tl.warning(tl.loc("Warning_AllowDuplicatesOnlyAvailableHosted"));
        }
        return false;
    }

    const nugetOverrideFlag = tl.getVariable("NuGet.ForceNuGetForPush");
    if (nugetOverrideFlag === "true") {
        tl.debug("NuGet.exe is force enabled for publish.");
        if(conflictsAllowed)
        {
            tl.warning(tl.loc("Warning_ForceNuGetCannotSkipConflicts"));
        }
        return false;
    }

    if (nugetOverrideFlag === "false") {
        tl.debug("NuGet.exe is force disabled for publish.");
        return true;
    }

    const vstsNuGetPushOverrideFlag = tl.getVariable("NuGet.ForceVstsNuGetPushForPush");
    if (vstsNuGetPushOverrideFlag === "true") {
        tl.debug("VstsNuGetPush.exe is force enabled for publish.");
        return true;
    }

    if (vstsNuGetPushOverrideFlag === "false") {
        tl.debug("VstsNuGetPush.exe is force disabled for publish.");
        if(conflictsAllowed)
        {
            tl.warning(tl.loc("Warning_ForceNuGetCannotSkipConflicts"));
        }
        return false;
    }

    // Use VstsNugetPush only if conflictsAllowed is checked. Otherwise use Nuget as default.
    if (conflictsAllowed){
        return true;
    }

    return false;
}
