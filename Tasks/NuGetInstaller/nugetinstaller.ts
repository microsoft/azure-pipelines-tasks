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
var preCredProviderNuGet = tl.getBoolInput('preCredProviderNuGet');

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

// due to a bug where we accidentally allowed nuGetPath to be surrounded by quotes before,
// locateNuGetExe() will strip them and check for existence there.
var userNuGetPath = tl.getPathInput('nuGetPath', false, false);
if (!tl.filePathSupplied('nuGetPath')) {
    userNuGetPath = null;
}

var serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

//find nuget location to use
var nuGetPathToUse = ngToolRunner.locateNuGetExe(userNuGetPath);
var credProviderPath = ngToolRunner.locateCredentialProvider();

var credProviderDir: string = null;
if (credProviderPath) {
    credProviderDir = path.dirname(credProviderPath)
}
else {
    tl._writeLine(tl.loc("NoCredProviderOnAgent"));
}

var accessToken = auth.getSystemAccessToken();
let buildIdentityDisplayName: string = null;
let buildIdentityAccount: string = null;

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
locationHelpers.assumeNuGetUriPrefixes(serviceUri)
    .then(urlPrefixes => {
        tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        let testPrefixes = tl.getVariable("NuGetTasks.ExtraUrlPrefixesForTesting");
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(';'));
            tl.debug(`all URL prefixes: ${urlPrefixes}`)
        }

        return new auth.NuGetAuthInfo(urlPrefixes, accessToken);
    })
    .then(authInfo => {
        var environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            authInfo: authInfo,
            credProviderFolder: credProviderDir,
            extensionsDisabled: !userNuGetPath
        }

        var configFilePromise = Q<string>(nugetConfigPath);
        var credCleanup = () => { return };
        if (!ngToolRunner.isCredentialConfigEnabled()) {
            tl.debug("Not configuring credentials in nuget.config");
        }
        else if (!credProviderDir || (userNuGetPath && preCredProviderNuGet)) {
            if (nugetConfigPath) {
                var nuGetConfigHelper = new NuGetConfigHelper(nuGetPathToUse, nugetConfigPath, authInfo, environmentSettings);
                configFilePromise = nuGetConfigHelper.getSourcesFromConfig()
                    .then(packageSources => {
                        if (packageSources.length === 0) {
                            // nothing to do; calling code should use the user's config unmodified.
                            return nugetConfigPath;
                        }
                        else {
                            nuGetConfigHelper.setSources(packageSources);
                            credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath, true);
                            return nuGetConfigHelper.tempNugetConfigPath;
                        }
                    });
                
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

        return configFilePromise.then(configFile => {
            var restoreOptions = new RestoreOptions(
                restoreMode,
                nuGetPathToUse,
                configFile,
                noCache,
                verbosity,
                nuGetRestoreArgs,
                environmentSettings);

            var result = Q({});
            filesList.forEach((solutionFile) => {
                result = result.then(() => {
                    return restorePackages(solutionFile, restoreOptions);
                })
            })
            return result.fin(credCleanup);
        })
    })
    .then(() => {
        tl._writeLine(tl.loc('PackagesInstalledSuccessfully'));
        tl.exit(0);
    })
    .fail((err) => {
        tl.error(err);
        tl.error(tl.loc('PackagesFailedToInstall'));

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        if (userNuGetPath && !preCredProviderNuGet) {
            tl.warning(tl.loc('LegacyNuGetHint', userNuGetPath));
        }

        tl.exit(1);
    })
    .done();

function restorePackages(solutionFile: string, options: RestoreOptions): Q.Promise<number> {
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

    if (options.verbosity) {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    if (options.extraArgs) {
        nugetTool.argString(options.extraArgs);
    }

    return nugetTool.exec({cwd: path.dirname(solutionFile)});
}