/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../definitions/nuget-task-common.d.ts" />

import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import toolrunner = require('vsts-task-lib/toolrunner');
import util = require('util');

import locationHelpers = require("nuget-task-common/LocationHelpers");
import * as ngToolRunner from 'nuget-task-common/NuGetToolRunner';
import * as nutil from 'nuget-task-common/Utility';
import * as auth from 'nuget-task-common/Authentication'
import {NuGetConfigHelper} from 'nuget-task-common/NuGetConfigHelper'
import * as os from 'os';

class RestoreOptions {
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
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        var solution = tl.getPathInput('solution', true, false);
        var filesList = nutil.resolveFilterSpec(solution, tl.getVariable('System.DefaultWorkingDirectory') || process.cwd());
        filesList.forEach(solutionFile => {
            if (!tl.stats(solutionFile).isFile()) {
                throw new Error(tl.loc('NotARegularFile', solutionFile));
            }
        });

        var noCache = tl.getBoolInput('noCache');
        var nuGetRestoreArgs = tl.getInput('nuGetRestoreArgs');
        var verbosity = tl.getInput('verbosity');
        

        var restoreMode = tl.getInput('restoreMode') || "Restore";
        // normalize the restore mode for display purposes, and ensure it's a known one
        var normalizedRestoreMode = ['restore', 'install'].find(x => restoreMode.toUpperCase() == x.toUpperCase());
        if (!normalizedRestoreMode) {
            throw new Error(tl.loc("UnknownRestoreMode", restoreMode))
        }

        restoreMode = normalizedRestoreMode;

        var nugetConfigPath = tl.getPathInput('nugetConfigPath', false, true);
        if (!tl.filePathSupplied('nugetConfigPath')) {
            nugetConfigPath = null;
        }

        var nugetVersion = tl.getInput('nuGetVersion');

        // due to a bug where we accidentally allowed nuGetPath to be surrounded by quotes before,
        // locateNuGetExe() will strip them and check for existence there.
        var nuGetPath = tl.getPathInput('nuGetPath', false, false);
        var userNuGetProvided = false;
        if(tl.filePathSupplied('nuGetPath')){
            // True if the user provided their own version of NuGet
            userNuGetProvided = true;
            if (nugetVersion !== "external"){
                // For back compat, if a path has already been specificed then use it.
                // However warn the user in the build of this behavior
                tl.warning(tl.loc("Warning_ConflictingNuGetPreference"));
            }
        }
        else {
            if (nugetVersion === "external")
            {
                throw new Error(tl.loc("NoNuGetSpecified"))
            }
            // Pull the pre-installed path for NuGet.
            nuGetPath = nutil.getBundledNuGetLocation(nugetVersion);
        }

        var serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

        //find nuget location to use
        var credProviderPath = ngToolRunner.locateCredentialProvider();

        var credProviderDir: string = null;
        if (credProviderPath) {
            credProviderDir = path.dirname(credProviderPath)
        }
        else {
            tl._writeLine(tl.loc("NoCredProviderOnAgent"));
        }

        var accessToken = auth.getSystemAccessToken();

        /*
        BUG: HTTP calls to access the location service currently do not work for customers behind proxies.
        locationHelpers.getNuGetConnectionData(serviceUri, accessToken)
            .then(connectionData => {
                buildIdentityDisplayName = locationHelpers.getIdentityDisplayName(connectionData.authorizedUser);
                buildIdentityAccount = locationHelpers.getIdentityAccount(connectionData.authorizedUser);
        
                tl._writeLine(tl.loc('ConnectingAs', buildIdentityDisplayName, buildIdentityAccount));
                return connectionData;
            })
            .then(locationHelpers.getAllAccessMappingUris)
            .fail(err => {
                if (err.code && err.code == 'AreaNotFoundInSps') {
                    tl.warning(tl.loc('CouldNotFindNuGetService'))
                    return <string[]>[];
                }
        
                throw err;
            })*/
        let urlPrefixes = await locationHelpers.assumeNuGetUriPrefixes(serviceUri);

        tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(';'));
            tl.debug(`all URL prefixes: ${urlPrefixes}`)
        }

        const authInfo = new auth.NuGetAuthInfo(urlPrefixes, accessToken);
        var environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            authInfo: authInfo,
            credProviderFolder: credProviderDir,
            extensionsDisabled: !userNuGetProvided
        }

        let configFile = nugetConfigPath;
        var credCleanup = () => { return };
        if (!ngToolRunner.isCredentialConfigEnabled()) {
            tl.debug("Not configuring credentials in nuget.config");
        }
        else if (!credProviderDir /* ||  TODO check nuget version eligibility*/ ) {
            if (nugetConfigPath) {
                var nuGetConfigHelper = new NuGetConfigHelper(nuGetPath, nugetConfigPath, authInfo, environmentSettings);
                const packageSources = await nuGetConfigHelper.getSourcesFromConfig()

                if (packageSources.length !== 0) {
                    nuGetConfigHelper.setSources(packageSources);
                    credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath, true);
                    configFile = nuGetConfigHelper.tempNugetConfigPath;
                }
            }
            else {
                if (credProviderDir) {
                    tl.warning(tl.loc('Warning_NoConfigForOldNuGet'));
                }
                else {
                    tl._writeLine(tl.loc('Warning_NoConfigForNoCredentialProvider'));
                }
            }
        }

        try {
            var restoreOptions = new RestoreOptions(
                restoreMode,
                nuGetPath,
                configFile,
                noCache,
                verbosity,
                nuGetRestoreArgs,
                environmentSettings);

            var result = Q({});
            for (const solutionFile of filesList) {
                await restorePackagesAsync(solutionFile, restoreOptions);
            }
        } finally {
            credCleanup();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PackagesInstalledSuccessfully'));
    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('PackagesFailedToInstall'));
    }
}

main();

function restorePackagesAsync(solutionFile: string, options: RestoreOptions): Q.Promise<number> {
    var nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment);
    nugetTool.arg(options.restoreMode)
    nugetTool.arg('-NonInteractive');

    nugetTool.pathArg(solutionFile);

    if (options.configFile) {
        nugetTool.arg('-ConfigFile');
        nugetTool.pathArg(options.configFile);
    }

    if (options.noCache) {
        nugetTool.arg('-NoCache');
    }

    if (options.verbosity && options.verbosity != "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    if (options.extraArgs) {
        nugetTool.argString(options.extraArgs);
    }

    return nugetTool.exec({ cwd: path.dirname(solutionFile) });
}