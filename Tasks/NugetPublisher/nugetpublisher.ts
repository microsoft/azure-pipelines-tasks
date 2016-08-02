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
import * as auth from 'nuget-task-common/Authentication';
import {NuGetConfigHelper} from 'nuget-task-common/NuGetConfigHelper';
import * as locationApi from 'nuget-task-common/LocationApi';
import * as os from 'os';

class PublishOptions {
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

tl.setResourcePath(path.join(__dirname, 'task.json'));

//read inputs
var searchPattern = tl.getPathInput('searchPattern', true, false);
var filesList = nutil.resolveFilterSpec(searchPattern, tl.getVariable('System.DefaultWorkingDirectory') || process.cwd());
filesList.forEach(packageFile => {
    if (!tl.stats(packageFile).isFile()) {
        throw new Error(tl.loc('NotARegularFile'));
    }
});

var connectedServiceName = tl.getInput('connectedServiceName');
var internalFeedUri = tl.getInput('feedName');
var nuGetAdditionalArgs = tl.getInput('nuGetAdditionalArgs');
var verbosity = tl.getInput('verbosity');
var preCredProviderNuGet = tl.getBoolInput('preCredProviderNuGet');

var nuGetFeedType = tl.getInput('nuGetFeedType') || "external";
// make sure the feed type is an expected one
var normalizedNuGetFeedType = ['internal', 'external'].find(x => nuGetFeedType.toUpperCase() == x.toUpperCase());
if (!normalizedNuGetFeedType) {
    throw new Error(tl.loc("UnknownFeedType", nuGetFeedType))
}

nuGetFeedType = normalizedNuGetFeedType;

var userNuGetPath = tl.getPathInput('nuGetPath', false, true);
if (!tl.filePathSupplied('nuGetPath')) {
    userNuGetPath = null;
}

var serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);

//find nuget location to use
var nuGetPathToUse = ngToolRunner.locateNuGetExe(userNuGetPath);
var credProviderPath = null;//ngToolRunner.locateCredentialProvider();

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

        var configFilePromise = Q<string>(null);
        var apiKey: string;
        var feedUri: string;
        var credCleanup = () => { return };
        if (nuGetFeedType == "internal") {
            if (!credProviderDir || (userNuGetPath && preCredProviderNuGet)) {
                var nuGetConfigHelper = new NuGetConfigHelper(nuGetPathToUse, null, authInfo, environmentSettings);
                nuGetConfigHelper.setSources([{ feedName: "internalFeed", feedUri: internalFeedUri }]);
                configFilePromise = Q(nuGetConfigHelper.tempNugetConfigPath);
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath, true);
            }

            apiKey = "VSTS";
            feedUri = internalFeedUri;
        }
        else {
            feedUri = tl.getEndpointUrl(connectedServiceName, false);
            var externalAuth = tl.getEndpointAuthorization(connectedServiceName, false);
            apiKey = externalAuth.parameters['password'];
        }

        return configFilePromise.then(configFile => {
            var publishOptions = new PublishOptions(
                nuGetPathToUse,
                feedUri,
                apiKey,
                configFile,
                verbosity,
                nuGetAdditionalArgs,
                environmentSettings);

            var result = Q({});
            filesList.forEach((solutionFile) => {
                result = result.then(() => {
                    return publishPackage(solutionFile, publishOptions);
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

function publishPackage(packageFile: string, options: PublishOptions): Q.Promise<number> {
    var nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment);
    nugetTool.arg('push')

    nugetTool.arg('-NonInteractive');

    nugetTool.pathArg(packageFile);

    nugetTool.arg(["-Source", options.feedUri]);

    nugetTool.argIf(options.apiKey, ['-ApiKey', options.apiKey]);

    if (options.configFile) {
        nugetTool.arg('-ConfigFile');
        nugetTool.pathArg(options.configFile);
    }

    if (options.verbosity) {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    if (options.extraArgs) {
        nugetTool.argString(options.extraArgs);
    }

    return nugetTool.exec();
}