import * as path from "path";
import * as Q  from "q";
import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import INuGetCommandOptions from "azure-pipelines-tasks-packaging-common/nuget/INuGetCommandOptions";
import {NuGetConfigHelper} from "azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper";
import * as ngToolGetter from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter";
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";

class RestoreOptions implements INuGetCommandOptions {
    constructor(
        public restoreMode: string,
        public nuGetPath: string,
        public configFile: string,
        public noCache: boolean,
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
        tl.debug(JSON.stringify(error));
        throw error;
    }

    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;

    try {
        tl.setResourcePath(path.join(__dirname, "task.json"));

        nutil.setConsoleCodePage();

        // read inputs
        let solution = tl.getPathInput("solution", true, false);
        let filesList = nutil.resolveFilterSpec(
            solution,
            tl.getVariable("System.DefaultWorkingDirectory") || process.cwd());
        filesList.forEach(solutionFile => {
            if (!tl.stats(solutionFile).isFile()) {
                throw new Error(tl.loc("NotARegularFile", solutionFile));
            }
        });

        let noCache = tl.getBoolInput("noCache");
        let nuGetRestoreArgs = tl.getInput("nuGetRestoreArgs");
        let verbosity = tl.getInput("verbosity");

        let restoreMode = tl.getInput("restoreMode") || "Restore";
        // normalize the restore mode for display purposes, and ensure it's a known one
        let normalizedRestoreMode = ["restore", "install"].find(x => restoreMode.toUpperCase() === x.toUpperCase());
        if (!normalizedRestoreMode) {
            throw new Error(tl.loc("UnknownRestoreMode", restoreMode));
        }

        restoreMode = normalizedRestoreMode;

        let nugetConfigPath = tl.getPathInput("nugetConfigPath", false, true);
        if (!tl.filePathSupplied("nugetConfigPath")) {
            nugetConfigPath = null;
        }

        let nugetUxOption = tl.getInput('nuGetVersion');

        // due to a bug where we accidentally allowed nuGetPath to be surrounded by quotes before,
        // locateNuGetExe() will strip them and check for existence there.
        let nuGetPath = tl.getPathInput("nuGetPath", false, false);
        let userNuGetProvided = false;
        if(nuGetPath !== undefined && tl.filePathSupplied("nuGetPath")){
            nuGetPath = nutil.stripLeadingAndTrailingQuotes(nuGetPath);
            // True if the user provided their own version of NuGet
            userNuGetProvided = true;
            if (nugetUxOption !== "custom"){
                // For back compat, if a path has already been specificed then use it.
                // However warn the user in the build of this behavior
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
        };

        let configFile = nugetConfigPath;
        let credCleanup = () => { return; };
        if (useCredConfig) {
            if (nugetConfigPath) {
                let nuGetConfigHelper = new NuGetConfigHelper(
                    nuGetPath,
                    nugetConfigPath,
                    authInfo,
                    environmentSettings);
                const packageSources = await nuGetConfigHelper.getSourcesFromConfig();

                if (packageSources.length !== 0) {
                    nuGetConfigHelper.setSources(packageSources, true);
                    credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                    configFile = nuGetConfigHelper.tempNugetConfigPath;
                }
            }
            else {
                tl.warning(tl.loc("Warning_NoConfigForNoCredentialProvider"));
            }
        }

        try {
            let restoreOptions = new RestoreOptions(
                restoreMode,
                nuGetPath,
                configFile,
                noCache,
                verbosity,
                nuGetRestoreArgs,
                environmentSettings);

            for (const solutionFile of filesList) {
                await restorePackagesAsync(solutionFile, restoreOptions);
            }
        } finally {
            credCleanup();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("PackagesInstalledSuccessfully"));
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc("PackagesFailedToInstall"));
    }
}

main();

function restorePackagesAsync(solutionFile: string, options: RestoreOptions): Q.Promise<number> {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment);
    nugetTool.arg(options.restoreMode);
    nugetTool.arg("-NonInteractive");

    nugetTool.arg(solutionFile);

    if (options.configFile) {
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(options.configFile);
    }

    if (options.noCache) {
        nugetTool.arg("-NoCache");
    }

    if (options.verbosity && options.verbosity !== "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    if (options.extraArgs) {
        nugetTool.line(options.extraArgs);
    }

    return nugetTool.exec({ cwd: path.dirname(solutionFile) } as IExecOptions);
}
