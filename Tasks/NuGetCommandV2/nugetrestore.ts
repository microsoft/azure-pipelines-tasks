import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions, IExecSyncResult} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import * as commandHelper from "azure-pipelines-tasks-packaging-common/nuget/CommandHelper";
import {NuGetConfigHelper2} from "azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper2";
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner2";
import peParser = require("azure-pipelines-tasks-packaging-common/pe-parser/index");
import {VersionInfo} from "azure-pipelines-tasks-packaging-common/pe-parser/VersionResource";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";
import INuGetCommandOptions from "azure-pipelines-tasks-packaging-common/nuget/INuGetCommandOptions2";
import { getProjectAndFeedIdFromInputParam } from "azure-pipelines-tasks-packaging-common/util";
import { logError } from "azure-pipelines-tasks-packaging-common/util";

class RestoreOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public configFile: string,
        public noCache: boolean,
        public disableParallelProcessing: boolean,
        public verbosity: string,
        public packagesDirectory: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings,
        public authInfo: auth.NuGetExtendedAuthInfo,
    ) { }
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

        // Reading inputs
        const solutionPattern = tl.getPathInput("solution", true, false);
        const useLegacyFind: boolean = tl.getVariable("NuGet.UseLegacyFindFiles") === "true";
        let filesList: string[] = [];
        if (!useLegacyFind) {
            const findOptions: tl.FindOptions = <tl.FindOptions>{};
            const matchOptions: tl.MatchOptions = <tl.MatchOptions>{};
            const searchPatterns: string[] = nutil.getPatternsArrayFromInput(solutionPattern);
            filesList = tl.findMatch(undefined, searchPatterns, findOptions, matchOptions);
        }
        else {
            filesList = nutil.resolveFilterSpec(
                solutionPattern,
                tl.getVariable("System.DefaultWorkingDirectory") || process.cwd());
        }
        filesList.forEach((solutionFile) => {
            if (!tl.stats(solutionFile).isFile()) {
                throw new Error(tl.loc("NotARegularFile", solutionFile));
            }
        });
        const noCache = tl.getBoolInput("noCache");
        const disableParallelProcessing = tl.getBoolInput("disableParallelProcessing");
        const verbosity = tl.getInput("verbosityRestore");
        let packagesDirectory = tl.getPathInput("packagesDirectory");
        if (!tl.filePathSupplied("packagesDirectory")) {
            packagesDirectory = null;
        }

        const nuGetVersion: VersionInfo = await peParser.getFileVersionInfoAsync(nuGetPath);

        // Discovering NuGet quirks based on the version
        tl.debug("Getting NuGet quirks");
        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);

        // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const useV1CredProvider: boolean = ngToolRunner.isCredentialProviderEnabled(quirks);
        const useV2CredProvider: boolean = ngToolRunner.isCredentialProviderV2Enabled(quirks);
        const credProviderPath: string = nutil.locateCredentialProvider(useV2CredProvider);
        const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks)
                                && (!useV1CredProvider && !useV2CredProvider);

        // Setting up auth-related variables
        tl.debug("Setting up auth");
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);
        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }
        const accessToken = pkgLocationUtils.getSystemAccessToken();
        const externalAuthArr: auth.ExternalAuthInfo[] = commandHelper.GetExternalAuthInfoArray("externalEndpoints");
        const authInfo = new auth.NuGetExtendedAuthInfo(
            new auth.InternalAuthInfo(
                urlPrefixes,
                accessToken,
                ((useV1CredProvider || useV2CredProvider) ? credProviderPath : null),
                useCredConfig),
            externalAuthArr);

        const environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: useV2CredProvider === false ? credProviderPath : null,
            V2CredProviderPath: useV2CredProvider === true ? credProviderPath : null,
            extensionsDisabled: true,
        };

        // Setting up sources, either from provided config file or from feed selection
        tl.debug("Setting up sources");
        let nuGetConfigPath : string = undefined;
        let configFile: string = undefined;
        let selectOrConfig = tl.getInput("selectOrConfig");
        // This IF is here in order to provide a value to nuGetConfigPath (if option selected, if user provided it)
        // and then pass it into the config helper
        if (selectOrConfig === "config") {
            nuGetConfigPath = tl.getPathInput("nugetConfigPath", false, true);
            if (!tl.filePathSupplied("nugetConfigPath")) {
                nuGetConfigPath = undefined;
            }

            // If using NuGet version 4.8 or greater and nuget.config was provided, 
            // do not create temp config file
            if (useV2CredProvider && nuGetConfigPath) {
                configFile = nuGetConfigPath;
            }
        }

        // If there was no nuGetConfigPath, NuGetConfigHelper will create a temp one
        const nuGetConfigHelper = new NuGetConfigHelper2(
                    nuGetPath,
                    nuGetConfigPath,
                    authInfo,
                    environmentSettings,
                    null);

        let credCleanup = () => { return; };


        let includeNuGetOrg : boolean;

        // Now that the NuGetConfigHelper was initialized with all the known information we can proceed
        // and check if the user picked the 'select' option to fill out the config file if needed
        if (selectOrConfig === "select") {
            const sources: auth.IPackageSource[] = new Array<auth.IPackageSource>();
            const feed = getProjectAndFeedIdFromInputParam('feedRestore');

            if (feed.feedId) {
                const feedUrl: string = await nutil.getNuGetFeedRegistryUrl(
                    packagingLocation.DefaultPackagingUri,
                    feed.feedId,
                    feed.projectId,
                    nuGetVersion,
                    accessToken);
                sources.push({
                    feedName: feed.feedId,
                    feedUri: feedUrl,
                    isInternal: true,
                });
            }
             
            includeNuGetOrg = tl.getBoolInput("includeNuGetOrg", false);
            if (includeNuGetOrg) {
                const nuGetSource: auth.IPackageSource = nuGetVersion.productVersion.a < 3
                                        ? auth.NuGetOrgV2PackageSource
                                        : auth.NuGetOrgV3PackageSource;
                sources.push(nuGetSource);
            }

            // Creating NuGet.config for the user
            if (sources.length > 0)
            {
                // tslint:disable-next-line:max-line-length
                tl.debug(`Adding the following sources to the config file: ${sources.map((x) => x.feedName).join(";")}`);
                nuGetConfigHelper.addSourcesToTempNuGetConfig(sources);
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                nuGetConfigPath = nuGetConfigHelper.tempNugetConfigPath;
            }
            else {
                tl.debug("No sources were added to the temp NuGet.config file");
            }
        }

        if (!useV2CredProvider && !configFile) {
            // Setting creds in the temp NuGet.config if needed
            nuGetConfigHelper.setAuthForSourcesInTempNuGetConfig();
            tl.debug('Setting nuget.config auth');
        } else {
            // In case of !!useV2CredProvider, V2 credential provider will handle external credentials
            tl.debug('No temp nuget.config auth');
        }
        // if configfile has already been set, let it be
        if (!configFile) {
            // Use config file if:
            //     - User selected "Select feeds" option
            //     - User selected "NuGet.config" option and the nuGetConfig input has a value
            let useConfigFile: boolean = selectOrConfig === "select" || (selectOrConfig === "config" && !!nuGetConfigPath);
            configFile = useConfigFile ? nuGetConfigHelper.tempNugetConfigPath : undefined;

            if (useConfigFile)
            {
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
            }
        }
        tl.debug(`ConfigFile: ${configFile}`);
        environmentSettings.configFile = configFile;

        try {
            const restoreOptions = new RestoreOptions(
                nuGetPath,
                configFile,
                noCache,
                disableParallelProcessing,
                verbosity,
                packagesDirectory,
                environmentSettings,
                authInfo);

            for (const solutionFile of filesList) {
                restorePackages(solutionFile, restoreOptions);
            }
        } finally {
            credCleanup();
        }

        setTaskResultOnNugetBehavior(includeNuGetOrg);
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToInstall"));
    }
}

function setTaskResultOnNugetBehavior(includeNuGetOrg: boolean){
    // If includeNuGetOrg is true, check the INCLUDE_NUGETORG_BEHAVIOR env variable to determine task result 
    // this allows compliance checks to warn or break the task if consuming from nuget.org directly 
    const nugetOrgBehavior = includeNuGetOrg ? tl.getVariable("INCLUDE_NUGETORG_BEHAVIOR") : undefined;
    tl.debug(`NugetOrgBehavior: ${nugetOrgBehavior}`);

    switch(nugetOrgBehavior?.toLowerCase())
    {
        case "warn":
            tl.setResult(tl.TaskResult.SucceededWithIssues, tl.loc("Warning_IncludeNuGetOrgEnabled"));
            break;
        case "fail":
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_IncludeNuGetOrgEnabled"));
            break;
        default:
            tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesInstalledSuccessfully"));
            break;
    }
}

function restorePackages(solutionFile: string, options: RestoreOptions): IExecSyncResult {
    const nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment, options.authInfo);

    nugetTool.arg("restore");
    nugetTool.arg(solutionFile);

    if (options.packagesDirectory) {
        nugetTool.arg("-PackagesDirectory");
        nugetTool.arg(options.packagesDirectory);
    }

    if (options.noCache) {
        nugetTool.arg("-NoCache");
    }

    if (options.disableParallelProcessing) {
        nugetTool.arg("-DisableParallelProcessing");
    }

    if (options.verbosity && options.verbosity !== "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    nugetTool.arg("-NonInteractive");

    if (options.configFile) {
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(options.configFile);
    }

    const execResult = nugetTool.execSync({ cwd: path.dirname(solutionFile) } as IExecOptions);
    if (execResult.code !== 0) {
        telemetry.logResult("Packaging", "NuGetCommand", execResult.code);
        throw tl.loc("Error_NugetFailedWithCodeAndErr",
            execResult.code,
            execResult.stderr ? execResult.stderr.trim() : execResult.stderr);
    }
    return execResult;
}
