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
import INuGetCommandOptions from 'nuget-task-common/INuGetCommandOptions';

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
    let buildIdentityDisplayName: string = null;
    let buildIdentityAccount: string = null;
    try {

        tl.setResourcePath(path.join(__dirname, 'task.json'));

        //read inputs
        var searchPattern = tl.getPathInput('searchPattern', true, false);
        var filesList = nutil.resolveFilterSpec(searchPattern, tl.getVariable('System.DefaultWorkingDirectory') || process.cwd());
        filesList.forEach(packageFile => {
            if (!tl.stats(packageFile).isFile()) {
                throw new Error(tl.loc('NotARegularFile', packageFile));
            }
        });

        var connectedServiceName = tl.getInput('connectedServiceName');
        var internalFeedUri = tl.getInput('feedName');
        var nuGetAdditionalArgs = tl.getInput('nuGetAdditionalArgs');
        var verbosity = tl.getInput('verbosity');

        var nuGetFeedType = tl.getInput('nuGetFeedType') || "external";
        // make sure the feed type is an expected one
        var normalizedNuGetFeedType = ['internal', 'external'].find(x => nuGetFeedType.toUpperCase() == x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc("UnknownFeedType", nuGetFeedType))
        }

        nuGetFeedType = normalizedNuGetFeedType;

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

        const quirks = await ngToolRunner.getNuGetQuirksAsync(nuGetPathToUse);

        // clauses ordered in this way to avoid short-circuit evaluation, so the debug info printed by the functions
        // is unconditionally displayed
        const useCredProvider = ngToolRunner.isCredentialProviderEnabled(quirks) && credProviderPath;
        const useCredConfig = ngToolRunner.isCredentialConfigEnabled(quirks) && !useCredProvider;

        var accessToken = auth.getSystemAccessToken();
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
            credProviderFolder: useCredProvider ? path.dirname(credProviderPath) : null,
            extensionsDisabled: !userNuGetPath
        }

        var configFile = null;
        var apiKey: string;
        var feedUri: string;
        var credCleanup = () => { return };
        if (nuGetFeedType == "internal") {
            if (useCredConfig) {
                var nuGetConfigHelper = new NuGetConfigHelper(nuGetPathToUse, null, authInfo, environmentSettings);
                nuGetConfigHelper.setSources([{ feedName: "internalFeed", feedUri: internalFeedUri }]);
                configFile = nuGetConfigHelper.tempNugetConfigPath;
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

        try {
            var publishOptions = new PublishOptions(
                nuGetPathToUse,
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
            credCleanup()
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PackagesPublishedSuccessfully'));

    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc("BuildIdentityPermissionsHint", buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('PackagesFailedToPublish'))
    }
}

main();

function publishPackageAsync(packageFile: string, options: PublishOptions): Q.Promise<number> {
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

    if (options.verbosity && options.verbosity != "-") {
        nugetTool.arg("-Verbosity");
        nugetTool.arg(options.verbosity);
    }

    if (options.extraArgs) {
        nugetTool.argString(options.extraArgs);
    }

    return nugetTool.exec();
}