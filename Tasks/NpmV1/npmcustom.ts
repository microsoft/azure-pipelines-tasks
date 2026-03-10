import * as tl from 'azure-pipelines-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from './npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as npmutils from './npmutils';
import { PackagingLocation } from 'azure-pipelines-tasks-packaging-common/locationUtilities';

export async function run(packagingLocation: PackagingLocation, command?: string): Promise<void> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmrc = npmutils.getTempNpmrcPath();
    const npmRegistries: INpmRegistry[] = await getCustomRegistries(packagingLocation);
    const overrideNpmrc = (tl.getInput(NpmTaskInput.CustomRegistry) === RegistryLocation.Feed) ? true : false;

    for (const registry of npmRegistries) {
        if (registry.authOnly === false) {
            tl.debug(tl.loc('UsingRegistry', registry.url));
            npmutils.appendToNpmrc(npmrc, `registry=${registry.url}`);
        }

        tl.debug(tl.loc('AddingAuthRegistry', registry.url));
        npmutils.appendToNpmrc(npmrc, registry.auth);
    }

    const npm = new NpmToolRunner(workingDir, npmrc, overrideNpmrc);
    npm.line(command || tl.getInput(NpmTaskInput.CustomCommand, true));

    npm.execSync();

    tl.rmRF(npmrc);
    tl.rmRF(npmutils.getTempPath());
}

/** Return Custom NpmRegistry with masked auth*/
export async function getCustomRegistries(packagingLocation: PackagingLocation): Promise<INpmRegistry[]> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmRegistries: INpmRegistry[] = npmutils.resolveInternalFeedCredentials(workingDir, packagingLocation.PackagingUris);
    const registryLocation = tl.getInput(NpmTaskInput.CustomRegistry) || null;
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('UseFeed'));
            const feed = npmutils.getProjectAndFeedIdFromInputParam(NpmTaskInput.CustomFeed);
            npmRegistries.push(await NpmRegistry.FromFeedId(packagingLocation.DefaultPackagingUri, feed.feedId, feed.projectId));
            break;
        case RegistryLocation.Npmrc:
            tl.debug(tl.loc('UseNpmrc'));
            const endpointIds = tl.getDelimitedInput(NpmTaskInput.CustomEndpoint, ',');
            if (endpointIds && endpointIds.length > 0) {
                await Promise.all(endpointIds.map(async e => {
                    npmRegistries.push(await NpmRegistry.FromServiceEndpoint(e, true));
                }));
            }
            break;
    }
    return npmRegistries;
}
