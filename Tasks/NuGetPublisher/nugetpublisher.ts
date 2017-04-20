import * as path from "path";
import * as Q  from "q";
import * as tl from "vsts-task-lib/task";

import * as auth from "nuget-task-common/Authentication";
import INuGetCommandOptions from "nuget-task-common/INuGetCommandOptions";
import locationHelpers = require("nuget-task-common/LocationHelpers");
import {NuGetConfigHelper} from "nuget-task-common/NuGetConfigHelper";
import * as ngToolRunner from "nuget-task-common/NuGetToolRunner";
import * as nutil from "nuget-task-common/Utility";

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
        tl.setResourcePath(path.join(__dirname, "task.json"));

        nutil.setConsoleCodePage();

        // read inputs
        let searchPattern = tl.getPathInput("searchPattern", true, false);
        let allowEmptyNupkgMatch = tl.getBoolInput("continueOnEmptyNupkgMatch");
        let filesList = nutil.resolveFilterSpec(
            searchPattern,
            tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(),
            allowEmptyNupkgMatch);
        filesList.forEach(packageFile => {
            if (!tl.stats(packageFile).isFile()) {
                throw new Error(tl.loc("NotARegularFile", packageFile));
            }
        });

        let connectedServiceName = tl.getInput("connectedServiceName");
        let internalFeedUri = tl.getInput("feedName");
        let nuGetAdditionalArgs = tl.getInput("nuGetAdditionalArgs");
        let verbosity = tl.getInput("verbosity");

        let nuGetFeedType = tl.getInput("nuGetFeedType") || "external";
        // make sure the feed type is an expected one
        let normalizedNuGetFeedType
            = ["internal", "external"].find(x => nuGetFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc("UnknownFeedType", nuGetFeedType));
        }

        nuGetFeedType = normalizedNuGetFeedType;

        // due to a bug where we accidentally allowed nuGetPath to be surrounded by quotes before,
        // locateNuGetExe() will strip them and check for existence there.
        let nuGetPath = tl.getPathInput("nuGetPath", false, false);
        let nugetUxOption = tl.getInput("nuGetversion");
        let userNuGetProvided = false;
        if (nuGetPath !== null && tl.filePathSupplied("nuGetPath")) {
            nuGetPath = nutil.stripLeadingAndTrailingQuotes(nuGetPath);
            userNuGetProvided = true;
            if (nugetUxOption !== "custom")
            {
                // For back compat, if a path has already been specified then use it.
                // However, warn the user in the build of this behavior.
                tl.warning(tl.loc("Warning_ConflictingNuGetPreference"));
            }
        }
        else {
            if (nugetUxOption === "custom")
            {
                throw new Error(tl.loc("NoNuGetSpecified"))
            }
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
        }

        let configFile = null;
        let apiKey: string;
        let feedUri: string;
        let credCleanup = () => { return };
        if (nuGetFeedType == "internal") {
            if (useCredConfig) {
                let nuGetConfigHelper = new NuGetConfigHelper(nuGetPath, null, authInfo, environmentSettings);
                nuGetConfigHelper.setSources([{ feedName: "internalFeed", feedUri: internalFeedUri }], true);
                configFile = nuGetConfigHelper.tempNugetConfigPath;
                credCleanup = () => tl.rmRF(nuGetConfigHelper.tempNugetConfigPath);
            }

            apiKey = "VSTS";
            feedUri = internalFeedUri;
        }
        else {
            feedUri = tl.getEndpointUrl(connectedServiceName, false);
            let externalAuth = tl.getEndpointAuthorization(connectedServiceName, false);
            apiKey = externalAuth.parameters["password"];
        }

        try {
            let publishOptions = new PublishOptions(
                nuGetPath,
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

main();

function publishPackageAsync(packageFile: string, options: PublishOptions): Q.Promise<number> {
    let nugetTool = ngToolRunner.createNuGetToolRunner(options.nuGetPath, options.environment);
    nugetTool.arg("push");

    nugetTool.arg("-NonInteractive");

    nugetTool.arg(packageFile);

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

    if (options.extraArgs) {
        nugetTool.line(options.extraArgs);
    }

    return nugetTool.exec();
}
