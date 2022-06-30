import * as path from "path";
import * as Q  from "q";
import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import INuGetCommandOptions from "azure-pipelines-tasks-packaging-common/nuget/INuGetCommandOptions";
import {IPackageSource, NuGetConfigHelper} from "azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper";
import nuGetGetter = require("azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter");
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import peParser = require('azure-pipelines-tasks-packaging-common/pe-parser/index');
import {VersionInfo} from "azure-pipelines-tasks-packaging-common/pe-parser/VersionResource";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import { getProjectAndFeedIdFromInputParam } from "azure-pipelines-tasks-packaging-common/util";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";

const NUGET_ORG_V2_URL: string = "https://www.nuget.org/api/v2/";
const NUGET_ORG_V3_URL: string = "https://api.nuget.org/v3/index.json";

class RestoreOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public configFile: string,
        public noCache: boolean,
        public verbosity: string,
        public packagesDirectory: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings
    ) { }
}

async function main(): Promise<void> {
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        tl.debug("getting the uris");
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug("Unable to get packaging URIs");
        tl.debug(JSON.stringify(error));
        throw error;
    }
    tl.debug("got the uris");
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    let nuGetPath: string = undefined;
    let nuGetVersionString: string = null;
    try {
        tl.setResourcePath(path.join(__dirname, "task.json"));

        nutil.setConsoleCodePage();

        // Reading inputs
        let solution = tl.getPathInput("solution", true, false);
        let filesList = nutil.resolveFilterSpec(solution, tl.getVariable("System.DefaultWorkingDirectory") || process.cwd());
        filesList.forEach(solutionFile => {
            if (!tl.stats(solutionFile).isFile()) {
                throw new Error(tl.loc("NotARegularFile", solutionFile));
            }
        });
        let noCache = tl.getBoolInput("noCache");
        let verbosity = tl.getInput("verbosity");
        let packagesDirectory = tl.getPathInput("packagesDirectory");
        if (!tl.filePathSupplied("packagesDirectory")) {
            packagesDirectory = null;
        }
        
        // Getting NuGet
        tl.debug('Getting NuGet');
        try {
            nuGetPath = tl.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR);
            if (!nuGetPath){
                nuGetPath = await nuGetGetter.getNuGet("4.0.0");
            }
            tl.debug(`Using NuGet in path: ${nuGetPath}`);
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, error.message);
            return;
        }
        
        const nuGetVersion: VersionInfo = await peParser.getFileVersionInfoAsync(nuGetPath);
        if (nuGetVersion && nuGetVersion.fileVersion){
            nuGetVersionString = nuGetVersion.fileVersion.toString();
        }

        // Discovering NuGet quirks based on the version
        tl.debug('Getting NuGet quirks');
        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);
        let credProviderPath = nutil.locateCredentialProvider();
        // Clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
        const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;
        
        // Setting up auth-related variables
        tl.debug('Setting up auth');
        let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);;
        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }
        let accessToken = pkgLocationUtils.getSystemAccessToken();
        const authInfo = new auth.NuGetAuthInfo(urlPrefixes, accessToken);
        let environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            authInfo: authInfo,
            credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
            extensionsDisabled: true
        };

        // Setting up sources, either from provided config file or from feed selection
        tl.debug('Setting up sources');
        let nuGetConfigPath : string = undefined;
        let selectOrConfig = tl.getInput("selectOrConfig");
        // This IF is here in order to provide a value to nuGetConfigPath (if option selected, if user provided it)
        // and then pass it into the config helper
        if (selectOrConfig === "config" ) {
            nuGetConfigPath = tl.getPathInput("nugetConfigPath", false, true);
            if (!tl.filePathSupplied("nugetConfigPath")) {
                nuGetConfigPath = undefined;
            }
        }
        
        // If there was no nuGetConfigPath, NuGetConfigHelper will create one
        let nuGetConfigHelper = new NuGetConfigHelper(
                    nuGetPath,
                    nuGetConfigPath,
                    authInfo,
                    environmentSettings);
        
        let credCleanup = () => { return; };
        
        // Now that the NuGetConfigHelper was initialized with all the known information we can proceed
        // and check if the user picked the 'select' option to fill out the config file if needed
        if (selectOrConfig === "select" ) {
            let sources: Array<IPackageSource> = new Array<IPackageSource>();
            let feed = getProjectAndFeedIdFromInputParam("feed");
            
            if (feed.feedId) {
                if(feed.projectId) {
                    throw new Error(tl.loc("UnsupportedProjectScopedFeeds"));
                } else {
                    let feedUrl:string = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, feed.feedId, null, nuGetVersion, accessToken);
                    sources.push(<IPackageSource>
                    {
                        feedName: feed.feedId,
                        feedUri: feedUrl
                    })
                }
            }

            let includeNuGetOrg = tl.getBoolInput("includeNuGetOrg", false);
            if (includeNuGetOrg) {
                let nuGetUrl: string = nuGetVersion.productVersion.a < 3 ? NUGET_ORG_V2_URL : NUGET_ORG_V3_URL;
                sources.push(<IPackageSource>
                {
                    feedName: "NuGetOrg",
                    feedUri: nuGetUrl
                })
            }

            // Creating NuGet.config for the user
            if (sources.length > 0)
            {
                tl.debug(`Adding the following sources to the config file: ${sources.map(x => x.feedName).join(';')}`)
                nuGetConfigHelper.setSources(sources, false);
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                nuGetConfigPath = nuGetConfigHelper.tempNugetConfigPath;
            }
            else {
                tl.debug('No sources were added to the temp NuGet.config file');
            }
        }

        // Setting creds in the temp NuGet.config if needed
        let configFile = nuGetConfigPath;
        if (useCredConfig) {
            tl.debug('Config credentials should be used');
            if (nuGetConfigPath) {
                let nuGetConfigHelper = new NuGetConfigHelper(
                    nuGetPath,
                    nuGetConfigPath,
                    authInfo,
                    environmentSettings);
                const packageSources = await nuGetConfigHelper.getSourcesFromConfig();

                if (packageSources.length !== 0) {
                    nuGetConfigHelper.setSources(packageSources, true);
                    credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
                    configFile = nuGetConfigHelper.tempNugetConfigPath;
                }
                else {
                    tl.debug('No package sources were added');
                }
            }
            else {
                console.log(tl.loc("Warning_NoConfigForNoCredentialProvider"));
            }
        }

        try {
            let restoreOptions = new RestoreOptions(
                nuGetPath,
                configFile,
                noCache,
                verbosity,
                packagesDirectory,
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
    } finally {
        _logNuGetRestoreVariables(nuGetPath, nuGetVersionString);
    }
}

function restorePackagesAsync(solutionFile: string, options: RestoreOptions): Q.Promise<number> {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment);

    nugetTool.arg("restore");
    nugetTool.arg(solutionFile);

    if (options.packagesDirectory) {
        nugetTool.arg("-PackagesDirectory");
        nugetTool.arg(options.packagesDirectory);
    }

    if (options.noCache) {
        nugetTool.arg("-NoCache");
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
    
    return nugetTool.exec({ cwd: path.dirname(solutionFile) } as IExecOptions);
}

function _logNuGetRestoreVariables(nuGetPath: string, nuGetVersion: string) {
    try {
        const telem = {
            "solution": tl.getPathInput("solution", true, false),
            "isNoCacheEnabled": tl.getBoolInput("noCache"),
            "verbosity": tl.getInput("verbosity"),
            "packagesDirectory": tl.getPathInput("packagesDirectory"),
            "NUGET_EXE_TOOL_PATH_ENV_VAR": tl.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
            "nuGetPath": nuGetPath,
            "nuGetVersion": nuGetVersion,
            "SYSTEMVSSCONNECTION": tl.getEndpointUrl("SYSTEMVSSCONNECTION", false),
            "ExtraUrlPrefixesForTesting": tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting"),
            "selectOrConfig": tl.getInput("selectOrConfig"),
            "nugetConfigPath": tl.getPathInput("nugetConfigPath", false, true),
            "isIncludeNuGetOrgEnabled": tl.getBoolInput("includeNuGetOrg", false)
        };
        telemetry.emitTelemetry("Packaging", "NuGetRestore", telem);
    } catch (err) {
        tl.debug(`Unable to log NuGet Tool Installer task init telemetry. Err:(${err})`);
    }
}

main();
