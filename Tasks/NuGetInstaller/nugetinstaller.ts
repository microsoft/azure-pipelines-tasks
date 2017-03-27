import * as path from "path";
import * as Q  from "q";
import * as tl from "vsts-task-lib/task";
import {IExecOptions} from "vsts-task-lib/toolrunner";

import * as auth from "nuget-task-common/Authentication";
import INuGetCommandOptions from "nuget-task-common/INuGetCommandOptions";
import locationHelpers = require("nuget-task-common/LocationHelpers");
import {NuGetConfigHelper} from "nuget-task-common/NuGetConfigHelper";
import * as ngToolRunner from "nuget-task-common/NuGetToolRunner";
import * as nutil from "nuget-task-common/Utility";

"use strict";

const NUGET_ORG_V2_URL: string = "https://www.nuget.org/api/v2/";

class RestoreOptions implements INuGetCommandOptions {
    constructor(
        public nuGetPath: string,
        public configFile: string,
        public noCache: boolean,
        public verbosity: string,
        public packagesDirectory: string,
        public source: string,
        public environment: ngToolRunner.NuGetEnvironmentSettings
    ) { }
}

async function main(): Promise<void> {
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
        let verbosity = tl.getInput("verbosity");

        let packagesDirectory = tl.getPathInput("packagesDirectory");

        if (!tl.filePathSupplied("packagesDirectory")) {
            packagesDirectory = null;
        }

        let source : string = null;
        let nuGetConfigPath : string = null;
        let selectOrConfig = tl.getInput("selectOrConfig");
        if (selectOrConfig === "select" ) {
            let feeds : Array<string> = [];
            let feed = tl.getInput("feed");
            if (feed) {
                feeds.push(feed);
            }
            let includeNuGetOrg = tl.getBoolInput("includeNuGetOrg", false);
            if (includeNuGetOrg) {
                feeds.push(NUGET_ORG_V2_URL); // todo: use v3 endpoint if nuget version >= 3.2
            }
            source = feeds.join(";");
        } else /*"config"*/ {
            nuGetConfigPath = tl.getPathInput("nugetConfigPath", false, true);
            if (!tl.filePathSupplied("nugetConfigPath")) {
                nuGetConfigPath = null;
            }
        }

        let nugetUxOption = tl.getInput('nuGetVersion');

        // due to a bug where we accidentally allowed nuGetPath to be surrounded by quotes before,
        // locateNuGetExe() will strip them and check for existence there.
        let nuGetPath = tl.getPathInput("nuGetPath", false, false);
        let userNuGetProvided = false;
        if(nuGetPath !== null && tl.filePathSupplied("nuGetPath")){
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
            nuGetPath = nutil.getBundledNuGetLocation(nugetUxOption);
        }

        let serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

        //find nuget location to use
        let credProviderPath = nutil.locateCredentialProvider();

        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPath);

        // clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
        const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;

        let accessToken = auth.getSystemAccessToken();
        let urlPrefixes = await locationHelpers.assumeNuGetUriPrefixes(serviceUri);
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

        let configFile = nuGetConfigPath;
        let credCleanup = () => { return; };
        if (useCredConfig) {
            if (nuGetConfigPath) {
                let nuGetConfigHelper = new NuGetConfigHelper(
                    nuGetPath,
                    nuGetConfigPath,
                    authInfo,
                    environmentSettings);
                const packageSources = await nuGetConfigHelper.getSourcesFromConfig();

                if (packageSources.length !== 0) {
                    nuGetConfigHelper.setSources(packageSources);
                    credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath, true);
                    configFile = nuGetConfigHelper.tempNugetConfigPath;
                }
            }
            else {
                tl._writeLine(tl.loc("Warning_NoConfigForNoCredentialProvider"));
            }
        }

        try {
            let restoreOptions = new RestoreOptions(
                nuGetPath,
                configFile,
                noCache,
                verbosity,
                packagesDirectory,
                source,
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

    nugetTool.arg("restore");
    nugetTool.arg(solutionFile);

    if (options.packagesDirectory) {
        nugetTool.arg("-PackagesDirectory");
        nugetTool.arg(options.packagesDirectory);
    }

    if (options.source) {
        nugetTool.arg("-Source");
        nugetTool.arg(options.source);
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
