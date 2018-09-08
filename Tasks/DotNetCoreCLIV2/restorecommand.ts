import * as tl from 'vsts-task-lib/task';
import * as Q from 'q';
import * as utility from './Common/utility';
import locationHelpers = require('nuget-task-common/LocationHelpers');
import * as auth from 'nuget-task-common/Authentication';
import { NuGetConfigHelper2 } from 'nuget-task-common/NuGetConfigHelper2';
import * as path from 'path';
import { IPackageSource } from 'nuget-task-common/Authentication';
import { IExecOptions } from 'vsts-task-lib/toolrunner';
import * as nutil from 'nuget-task-common/Utility';
import * as commandHelper from 'nuget-task-common/CommandHelper';
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
        const projectSearch = tl.getDelimitedInput('projects', '\n', false);

        // if no projectSearch strings are given, use "" to operate on the current directory
        const projectFiles = utility.getProjectFiles(projectSearch);

        if (projectFiles.length === 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('Info_NoFilesMatchedTheSearchPattern'));
            return;
        }
        const noCache = tl.getBoolInput('noCache');
        const verbosity = tl.getInput('verbosityRestore');
        let packagesDirectory = tl.getPathInput('packagesDirectory');
        if (!tl.filePathSupplied('packagesDirectory')) {
            packagesDirectory = null;
        }

        // Setting up auth-related variables
        tl.debug('Setting up auth');
        const serviceUri = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable('DotNetCoreCLITask.ExtraUrlPrefixesForTesting');
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(';'));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }

        const accessToken = auth.getSystemAccessToken();

        const externalAuthArr: auth.ExternalAuthInfo[] = commandHelper.GetExternalAuthInfoArray('externalEndpoints');
        const authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, /*useCredProvider*/ null, /*useCredConfig*/ true), externalAuthArr);

        // Setting up sources, either from provided config file or from feed selection
        tl.debug('Setting up sources');
        let nuGetConfigPath: string = undefined;
        const selectOrConfig = tl.getInput('selectOrConfig');

        // This IF is here in order to provide a value to nuGetConfigPath (if option selected, if user provided it)
        // and then pass it into the config helper
        if (selectOrConfig === 'config') {
            nuGetConfigPath = tl.getPathInput('nugetConfigPath', false, true);
            if (!tl.filePathSupplied('nugetConfigPath')) {
                nuGetConfigPath = undefined;
            }
        }

        // If there was no nuGetConfigPath, NuGetConfigHelper will create one
        const nuGetConfigHelper = new NuGetConfigHelper2(
            null,
            nuGetConfigPath,
            authInfo,
            { credProviderFolder: null, extensionsDisabled: true },
            null /* tempConfigPath */,
            false /* useNugetToModifyConfigFile */);

        let credCleanup = () => { return; };

        // Now that the NuGetConfigHelper was initialized with all the known information we can proceed
        // and check if the user picked the 'select' option to fill out the config file if needed
        if (selectOrConfig === 'select') {
            const sources: Array<IPackageSource> = new Array<IPackageSource>();
            const feed = tl.getInput('feedRestore');
            if (feed) {
                const feedUrl: string = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, accessToken, feed, null);
                sources.push(<IPackageSource>
                    {
                        feedName: feed,
                        feedUri: feedUrl,
                        isInternal: true
                    });
            }

            const includeNuGetOrg = tl.getBoolInput('includeNuGetOrg', false);
            if (includeNuGetOrg) {
                sources.push(<IPackageSource>
                    {
                        feedName: 'NuGetOrg',
                        feedUri: locationHelpers.NUGET_ORG_V3_URL,
                        isInternal: false
                    });
            }

            // Creating NuGet.config for the user
            if (sources.length > 0) {
                tl.debug(`Adding the following sources to the config file: ${sources.map(x => x.feedName).join(';')}`);
                nuGetConfigHelper.addSourcesToTempNuGetConfig(sources);
                credCleanup = () => { tl.rmRF(nuGetConfigHelper.tempNugetConfigPath); };
                nuGetConfigPath = nuGetConfigHelper.tempNugetConfigPath;
            } else {
                tl.debug('No sources were added to the temp NuGet.config file');
            }
        }

        // Setting creds in the temp NuGet.config if needed
        await nuGetConfigHelper.setAuthForSourcesInTempNuGetConfigAsync();

        const configFile = nuGetConfigHelper.tempNugetConfigPath;
        const dotnetPath = tl.which('dotnet', true);

        try {
            for (const projectFile of projectFiles) {
                await dotNetRestoreAsync(dotnetPath, projectFile, packagesDirectory, configFile, noCache, verbosity);
            }
        } finally {
            credCleanup();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('PackagesInstalledSuccessfully'));

    } catch (err) {

        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc('BuildIdentityPermissionsHint', buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('PackagesFailedToInstall'));
    }
}

function dotNetRestoreAsync(dotnetPath: string, projectFile: string, packagesDirectory: string, configFile: string, noCache: boolean, verbosity: string): Q.Promise<number> {
    const dotnet = tl.tool(dotnetPath);
    dotnet.arg('restore');

    if (projectFile) {
        dotnet.arg(projectFile);
    }

    if (packagesDirectory) {
        dotnet.arg('--packages');
        dotnet.arg(packagesDirectory);
    }

    dotnet.arg('--configfile');
    dotnet.arg(configFile);

    if (noCache) {
        dotnet.arg('--no-cache');
    }

    if (verbosity && verbosity !== '-') {
        dotnet.arg('--verbosity');
        dotnet.arg(verbosity);
    }

    return dotnet.exec({ cwd: path.dirname(projectFile) } as IExecOptions);
}
