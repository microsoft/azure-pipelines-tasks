import * as path from "path";
import * as Q  from "q";
import * as tl from "vsts-task-lib/task";

import INuGetCommandOptions from "./Common/INuGetCommandOptions";
import locationHelpers = require("nuget-task-common/LocationHelpers");
import {NuGetConfigHelper} from "./Common/NuGetConfigHelper";
import * as ngToolRunner from "./Common/NuGetToolRunner";
import * as vstsNuGetPushToolRunner from "./Common/VstsNuGetPushToolRunner";
import * as vstsNuGetPushToolUtilities from "./Common/VstsNuGetPushToolUtilities";
import * as nutil from "nuget-task-common/Utility";
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");
import * as vsts from "vso-node-api/WebApi";
import * as vsom from 'vso-node-api/VsoClient';
import {VersionInfo} from "nuget-task-common/pe-parser/VersionResource";
import {VersionInfoVersion} from "nuget-task-common/pe-parser/VersionInfoVersion";
import * as nugetCommonUtilities from "./Common/utilities"
import * as auth from "./Common/Authentication";
import { IPackageSource } from "./Common/Authentication";
import * as utilities from "./Common/utilities";
import peParser = require('nuget-task-common/pe-parser/index');
import * as util from "./Common/utilities";

class PublishOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public feedUri: string,
        public apiKey: string,
        public configFile: string,
        public verbosity: string,
        public authInfo: auth.NuGetAuthInfo,
        public environment: ngToolRunner.NuGetEnvironmentSettings
    ) { }
}

interface VstsNuGetPushOptions {
    vstsNuGetPushPath: string, 
    feedUri: string,
    internalAuthInfo: auth.InternalAuthInfo,
    verbosity: string,
    settings: vstsNuGetPushToolRunner.VstsNuGetPushSettings
}

export async function run(): Promise<void> {
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    try {
        nutil.setConsoleCodePage();

        // Get list of files to pusblish
        let searchPattern = tl.getPathInput("searchPatternPush", true, false);
        let filesList = nutil.resolveFilterSpec(
            searchPattern,
            tl.getVariable("System.DefaultWorkingDirectory") || process.cwd());
        filesList.forEach(packageFile => {
            if (!tl.stats(packageFile).isFile()) {
                throw new Error(tl.loc("Error_PushNotARegularFile", packageFile));
            }
        });

        if (filesList && filesList.length < 1)
        {
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("Info_NoPackagesMatchedTheSearchPattern"));
            return;
        }

        // Get the info the type of feed 
        let nugetFeedType = tl.getInput("nuGetFeedType") || "internal";
        // Make sure the feed type is an expected one
        let normalizedNuGetFeedType = ["internal", "external"].find(x => nugetFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc("UnknownFeedType", nugetFeedType));
        }
        nugetFeedType = normalizedNuGetFeedType;
        
        // Getting NuGet.exe
        tl.debug('Getting NuGet');
        let nuGetPath: string = undefined;
        try {
            nuGetPath = process.env[nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR];
            if (!nuGetPath){
                nuGetPath = await nuGetGetter.getNuGet("4.0.0");
            }
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error.message);
            return;
        }

        let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        let urlPrefixes = await locationHelpers.assumeNuGetUriPrefixes(serviceUri);
        tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`all URL prefixes: ${urlPrefixes}`);
        }

        // Setting up auth info
        let externalAuthArr = utilities.GetExternalAuthInfoArray("externalEndpoint");
        let accessToken = auth.getSystemAccessToken();
        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);
        let credProviderPath = nutil.locateCredentialProvider();
        // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        let useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
        let useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;
        let authInfo = new auth.NuGetAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, useCredProvider, useCredConfig), externalAuthArr);

        let environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
            extensionsDisabled: true 
            }
        let configFile = null;
        let apiKey: string;
        let credCleanup = () => { return };
        let nuGetConfigHelper = new NuGetConfigHelper(nuGetPath, null, authInfo, environmentSettings);
        let feedUri: string = undefined;
        let isInternalFeed: boolean = nugetFeedType === "internal";

        if (isInternalFeed) 
        {
            let internalFeedId = tl.getInput("feedPublish");
            if (useCredConfig) {
                
                nuGetConfigHelper.addSourcesToTempNuGetConfig([<IPackageSource>{ feedName: internalFeedId, feedUri: feedUri, isInternal: true }]);
                configFile = nuGetConfigHelper.tempNugetConfigPath;
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
            }

            apiKey = "VSTS";
            const nuGetVersion: VersionInfo = await peParser.getFileVersionInfoAsync(nuGetPath);
            feedUri = await utilities.getNuGetFeedRegistryUrl(accessToken, internalFeedId, nuGetVersion);
        }
        else {
            let externalAuth = externalAuthArr[0];

            if (!externalAuth)
            {
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoSourceSpecifiedForPush"));
                return;
            }

            nuGetConfigHelper.addSourcesToTempNuGetConfig([externalAuth.packageSource]);
            feedUri = externalAuth.packageSource.feedUri;
            configFile = nuGetConfigHelper.tempNugetConfigPath;
            credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);

            let authType: auth.ExternalAuthType = externalAuth.authType;
            switch(authType) {
                case (auth.ExternalAuthType.UsernamePassword):
                case (auth.ExternalAuthType.Token):
                    apiKey = "RequiredApiKey";
                    break;
                case (auth.ExternalAuthType.ApiKey):
                    let apiKeyAuthInfo =  externalAuth as auth.ApiKeyExternalAuthInfo;
                    apiKey = apiKeyAuthInfo.apiKey;
                    break;
                default:
                    break;
            }
        }

        await nuGetConfigHelper.setAuthForSourcesInTempNuGetConfigAsync();

        let verbosity = tl.getInput("verbosityPush");

        let continueOnConflict: boolean = tl.getBoolInput("allowPackageConflicts");
        if (continueOnConflict && util.isOnPremisesTfs())
        {
            tl.warning(tl.loc("Warning_AllowDuplicatesOnlyAvailableHosted"));
        }

        let useVstsNuGetPush = shouldUseVstsNuGetPush(isInternalFeed, continueOnConflict);
        let vstsPushPath = undefined;
        if (useVstsNuGetPush) {
            vstsPushPath = vstsNuGetPushToolUtilities.getBundledVstsNuGetPushLocation();

            if (!vstsPushPath)
            {
                tl.warning(tl.loc("Warning_FallBackToNuGet"));
            }
        }
    
        try {
            if (useVstsNuGetPush && vstsPushPath) {
                tl.debug('Using VstsNuGetPush.exe to push the packages');
                let vstsNuGetPushSettings = <vstsNuGetPushToolRunner.VstsNuGetPushSettings>
                {
                    continueOnConflict: continueOnConflict
                }

                let publishOptions = <VstsNuGetPushOptions> {
                    vstsNuGetPushPath: vstsPushPath, 
                    feedUri: feedUri,
                    internalAuthInfo: authInfo.internalAuthInfo,
                    verbosity: verbosity,
                    settings: vstsNuGetPushSettings
                }

                for (const packageFile of filesList) {
                    await publishPackageVstsNuGetPushAsync(packageFile, publishOptions);
                }
            }
            else {
                tl.debug('Using NuGet.exe to push the packages');
                let publishOptions = new PublishOptions(
                    nuGetPath,
                    feedUri,
                    apiKey,
                    configFile,
                    verbosity,
                    authInfo,
                    environmentSettings);

                for (const packageFile of filesList) {

                    await publishPackageNuGetAsync(packageFile, publishOptions, authInfo);
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

function publishPackageNuGetAsync(packageFile: string, options: PublishOptions, authInfo: auth.NuGetAuthInfo): Q.Promise<number> {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment, authInfo);
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

    return nugetTool.exec();
}

async function publishPackageVstsNuGetPushAsync(packageFile: string, options: VstsNuGetPushOptions) {
    let vstsNuGetPushTool = vstsNuGetPushToolRunner.createVstsNuGetPushToolRunner(options.vstsNuGetPushPath, options.settings, options.internalAuthInfo);
    vstsNuGetPushTool.arg(packageFile);
    vstsNuGetPushTool.arg(["-Source", options.feedUri]);
    vstsNuGetPushTool.arg(["-AccessToken", options.internalAuthInfo.accessToken]);
    vstsNuGetPushTool.arg("-NonInteractive")

    if (options.verbosity && options.verbosity.toLowerCase() === "detailed") {
        vstsNuGetPushTool.arg(["-Verbosity", "Detailed"]);
    }

    let exitCode: number = await vstsNuGetPushTool.exec();
    if (exitCode === 0)
    {
        return;
    }

    // ExitCode 2 means a push conflict occurred
    if (exitCode === 2 && options.settings.continueOnConflict)
    {
        return;
    }

    throw new Error(tl.loc("Error_UnexpectedErrorVstsNuGetPush"));
}

function shouldUseVstsNuGetPush(isInternalFeed: boolean, conflictsAllowed: boolean): boolean {
    if (!isInternalFeed)
    {   
        tl.debug('Pushing to an external feed so NuGet.exe will be used.');
        return false;
    }

    if (util.isOnPremisesTfs())
    {
        tl.debug('Pushing to an onPrem environment, only NuGet.exe is supported.');
        return false;
    }

    // TODO check if we can verify an external feed is actually VSTS
    const nugetOverrideFlag = tl.getVariable("NuGet.ForceNuGetForPush");
    if (nugetOverrideFlag === "true") {
        tl.debug("NuGet is force enabled for publish.");
        if(conflictsAllowed)
        {
            tl.warning(tl.loc("Warning_ForceNuGetCannotSkipConflicts"));
        }
        return false;
    }

    if (nugetOverrideFlag === "false") {
        tl.debug("NuGet is force disabled for publish.");
        return true;
    }

    const vstsNuGetPushOverrideFlag = tl.getVariable("NuGet.ForceVstsNuGetPushForPush");
    if (vstsNuGetPushOverrideFlag === "true") {
        tl.debug("VstsNuGetPush is force enabled for publish.");
        return true;
    }

    if (vstsNuGetPushOverrideFlag === "false") {
        tl.debug("VstsNuGetPush is force disabled for publish.");
        if(conflictsAllowed)
        {
            tl.warning(tl.loc("Warning_ForceNuGetCannotSkipConflicts"));
        }
        return false;
    }

    // NOTE: This should return true once VstsNuGetPush is packaged within the task
    return false;
}

