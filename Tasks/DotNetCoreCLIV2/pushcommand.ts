import * as Q from 'q';
import * as auth from 'nuget-task-common/Authentication';
import * as commandHelper from 'nuget-task-common/CommandHelper';
import * as nutil from 'nuget-task-common/Utility';
import * as path from 'path';
import * as tl from 'vsts-task-lib/task';

import { IExecOptions } from 'vsts-task-lib/toolrunner';
import { IPackageSource } from 'nuget-task-common/Authentication';
import { NuGetConfigHelper2 } from 'nuget-task-common/NuGetConfigHelper2';
import * as pkgLocationUtils from 'utility-common/packaging/locationUtilities';

export async function run(): Promise<void> {
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug('Unable to get packaging URIs, using default collection URI');
        tl.debug(JSON.stringify(error));
        const collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        packagingLocation = {
            PackagingUris: [collectionUrl],
            DefaultPackagingUri: collectionUrl
        };
    }

    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;
    try {
        // Get list of files to publish
        const searchPatternInput = tl.getPathInput('searchPatternPush', true, false);
        const findOptions: tl.FindOptions = <tl.FindOptions>{};
        const matchOptions: tl.MatchOptions = <tl.MatchOptions>{};
        const searchPatterns: string[] = nutil.getPatternsArrayFromInput(searchPatternInput);
        const filesList = tl.findMatch(undefined, searchPatterns, findOptions, matchOptions);

        filesList.forEach(packageFile => {
            if (!tl.stats(packageFile).isFile()) {
                throw new Error(tl.loc('Error_PushNotARegularFile', packageFile));
            }
        });

        if (filesList.length < 1) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('Info_NoPackagesMatchedTheSearchPattern'));
            return;
        }

        // Get the info the type of feed
        let nugetFeedType = tl.getInput('nuGetFeedType') || 'internal';

        // Make sure the feed type is an expected one
        const normalizedNuGetFeedType = ['internal', 'external'].find(x => nugetFeedType.toUpperCase() === x.toUpperCase());
        if (!normalizedNuGetFeedType) {
            throw new Error(tl.loc('UnknownFeedType', nugetFeedType));
        }
        nugetFeedType = normalizedNuGetFeedType;

        const serviceUri = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable('DotNetCoreCLITask.ExtraUrlPrefixesForTesting');
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(';'));
            tl.debug(`all URL prefixes: ${urlPrefixes}`);
        }

        // Setting up auth info
        const accessToken = auth.getSystemAccessToken();
        const isInternalFeed: boolean = nugetFeedType === 'internal';
        const useCredConfig = useCredentialConfiguration(isInternalFeed);
        const internalAuthInfo = new auth.InternalAuthInfo(urlPrefixes, accessToken, /*useCredProvider*/ null, useCredConfig);

        let configFile = null;
        let apiKey: string;
        let credCleanup = () => { return; };

        // dotnet nuget push does not currently accept a --config-file parameter
        // so we are going to work around this by creating a temporary working directory for dotnet with
        // a nuget config file it will load by default.
        const tempNuGetConfigDirectory = path.join(NuGetConfigHelper2.getTempNuGetConfigBasePath(), 'NuGet_' + tl.getVariable('build.buildId'));
        const tempNuGetPath = path.join(tempNuGetConfigDirectory, 'nuget.config');
        tl.mkdirP(tempNuGetConfigDirectory);

        let feedUri: string = undefined;

        let authInfo: auth.NuGetExtendedAuthInfo;
        let nuGetConfigHelper: NuGetConfigHelper2;

        if (isInternalFeed) {
            authInfo = new auth.NuGetExtendedAuthInfo(internalAuthInfo);
            nuGetConfigHelper = new NuGetConfigHelper2(
                null,
                null, /* nugetConfigPath */
                authInfo,
                { credProviderFolder: null, extensionsDisabled: true },
                tempNuGetPath,
                false /* useNugetToModifyConfigFile */);

            const internalFeedId = tl.getInput('feedPublish');
            feedUri = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, accessToken, internalFeedId, null);
            nuGetConfigHelper.addSourcesToTempNuGetConfig([<IPackageSource>{ feedName: internalFeedId, feedUri: feedUri, isInternal: true }]);
            configFile = nuGetConfigHelper.tempNugetConfigPath;
            credCleanup = () => { tl.rmRF(tempNuGetConfigDirectory); };

            apiKey = 'VSTS';
        } else {
            const externalAuthArr = commandHelper.GetExternalAuthInfoArray('externalEndpoint');
            authInfo = new auth.NuGetExtendedAuthInfo(internalAuthInfo, externalAuthArr);
            nuGetConfigHelper = new NuGetConfigHelper2(
                null,
                null, /* nugetConfigPath */
                authInfo,
                { credProviderFolder: null, extensionsDisabled: true },
                tempNuGetPath,
                false /* useNugetToModifyConfigFile */);

            const externalAuth = externalAuthArr[0];

            if (!externalAuth) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('Error_NoSourceSpecifiedForPush'));
                return;
            }

            nuGetConfigHelper.addSourcesToTempNuGetConfig([externalAuth.packageSource]);
            feedUri = externalAuth.packageSource.feedUri;
            configFile = nuGetConfigHelper.tempNugetConfigPath;
            credCleanup = () => { tl.rmRF(tempNuGetConfigDirectory); };

            const authType: auth.ExternalAuthType = externalAuth.authType;
            switch (authType) {
                case (auth.ExternalAuthType.UsernamePassword):
                case (auth.ExternalAuthType.Token):
                    apiKey = 'RequiredApiKey';
                    break;
                case (auth.ExternalAuthType.ApiKey):
                    const apiKeyAuthInfo = externalAuth as auth.ApiKeyExternalAuthInfo;
                    apiKey = apiKeyAuthInfo.apiKey;
                    break;
                default:
                    break;
            }
        }

        await nuGetConfigHelper.setAuthForSourcesInTempNuGetConfigAsync();

        const dotnetPath = tl.which('dotnet', true);

        try {
            for (const packageFile of filesList) {

                await dotNetNuGetPushAsync(dotnetPath, packageFile, feedUri, apiKey, configFile, tempNuGetConfigDirectory);
            }
        } finally {
            credCleanup();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PackagesPublishedSuccessfully'));

    } catch (err) {
        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc('BuildIdentityPermissionsHint', buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('PackagesFailedToPublish'));
    }
}

function dotNetNuGetPushAsync(dotnetPath: string, packageFile: string, feedUri: string, apiKey: string, configFile: string, workingDirectory: string): Q.Promise<number> {
    const dotnet = tl.tool(dotnetPath);

    dotnet.arg('nuget');
    dotnet.arg('push');

    dotnet.arg(packageFile);

    dotnet.arg('--source');
    dotnet.arg(feedUri);

    dotnet.arg('--api-key');
    dotnet.arg(apiKey);

    // dotnet.exe v1 and v2 do not accept the --verbosity parameter for the "nuget push"" command, although it does for other commands

    return dotnet.exec({ cwd: workingDirectory } as IExecOptions);
}

function useCredentialConfiguration(isInternalFeed: boolean): boolean {
    // if we are pushing to an internal on-premises server, then credential configuration is not possible
    // and integrated authentication must be used
    const useCredConfig = !(isInternalFeed && commandHelper.isOnPremisesTfs());
    if (!useCredConfig) {
        tl.debug('Push to internal OnPrem server detected. Credential configuration will be skipped.');
    }
    return useCredConfig;
}
