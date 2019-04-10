import * as tl from 'azure-pipelines-task-lib/task';
import * as Q from 'q';
import * as utility from './Common/utility';
import * as auth from 'packaging-common/nuget/Authentication';
import { NuGetConfigHelper2 } from 'packaging-common/nuget/NuGetConfigHelper2';
import * as ngRunner from 'packaging-common/nuget/NuGetToolRunner2';
import * as path from 'path';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import * as nutil from 'packaging-common/nuget/Utility';
import * as commandHelper from 'packaging-common/nuget/CommandHelper';
import * as pkgLocationUtils from 'packaging-common/locationUtilities';

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

        const accessToken = pkgLocationUtils.getSystemAccessToken();

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
            const sources: Array<auth.IPackageSource> = new Array<auth.IPackageSource>();
            const feed = tl.getInput('feedRestore');
            if (feed) {
                const feedUrl: string = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, feed, null, accessToken);
                sources.push(<auth.IPackageSource>
                    {
                        feedName: feed,
                        feedUri: feedUrl,
                        isInternal: true
                    });
            }

            const includeNuGetOrg = tl.getBoolInput('includeNuGetOrg', false);
            if (includeNuGetOrg) {
                sources.push(auth.NuGetOrgV3PackageSource);
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
        nuGetConfigHelper.setAuthForSourcesInTempNuGetConfig();

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

    const envWithProxy = ngRunner.setNuGetProxyEnvironment(process.env, configFile, null);
    return dotnet.exec({ cwd: path.dirname(projectFile), env: envWithProxy } as IExecOptions);
}
