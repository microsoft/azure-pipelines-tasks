import * as tl from 'azure-pipelines-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from 'azure-pipelines-tasks-packaging-common/npm/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import { PackagingLocation } from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import * as npmrcparser from 'azure-pipelines-tasks-packaging-common/npm/npmrcparser';
import { getFederatedWorkloadIdentityCredentials } from 'azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils';
import * as os from 'os';

export async function run(packagingLocation: PackagingLocation, command?: string): Promise<void> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmrc = npmutil.getTempNpmrcPath();
    const npmRegistries: INpmRegistry[] = await getCustomRegistries(packagingLocation);
    const customRegistryLocation = tl.getInput(NpmTaskInput.CustomRegistry);
    let overrideNpmrc = (customRegistryLocation === RegistryLocation.Feed) ? true : false;
    overrideNpmrc = overrideNpmrc || (customRegistryLocation === RegistryLocation.WorkloadIdentityFederation);

    for (const registry of npmRegistries) {
        if (registry.authOnly === false) {
            tl.debug(tl.loc('UsingRegistry', registry.url));
            npmutil.appendToNpmrc(npmrc, `registry=${registry.url}\n`);
        }

        tl.debug(tl.loc('AddingAuthRegistry', registry.url));
        npmutil.appendToNpmrc(npmrc, `${registry.auth}\n`);
    }

    const npm = new NpmToolRunner(workingDir, npmrc, overrideNpmrc);
    npm.line(command || tl.getInput(NpmTaskInput.CustomCommand, true));

    npm.execSync();

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}

/** Return Custom NpmRegistry with masked auth*/
export async function getCustomRegistries(packagingLocation: PackagingLocation): Promise<NpmRegistry[]> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmRegistries: INpmRegistry[] = await npmutil.getLocalNpmRegistries(workingDir, packagingLocation.PackagingUris);
    const registryLocation = tl.getInput(NpmTaskInput.CustomRegistry) || null;
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('UseFeed'));
            const feed = util.getProjectAndFeedIdFromInputParam(NpmTaskInput.CustomFeed);
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
        case RegistryLocation.WorkloadIdentityFederation:
            tl.debug(tl.loc('UseFeed'));
            npmRegistries.push(await getWorkloadIdentityFederationRegistry());
            break;
    }
    return npmRegistries;
}
/** Return an NpmRegistry authenticated with a federated (WIF) token for the given feedUrl */
async function getWorkloadIdentityFederationRegistry(): Promise<INpmRegistry> {
    const lineEnd = os.EOL;
    const serviceConnection = tl.getInput(NpmTaskInput.WorkloadIdentityServiceConnection, true);
    const feedUrl = tl.getInput(NpmTaskInput.FeedUrl, true);

    const url = npmrcparser.NormalizeRegistry(feedUrl);
    const nerfed = util.toNerfDart(url);

    console.log(tl.loc('Info_AddingFederatedFeedAuth', serviceConnection, url));
    const token = await getFederatedWorkloadIdentityCredentials(serviceConnection);
    if (!token) {
        throw new Error(tl.loc('FailedToGetServiceConnectionAuth', serviceConnection));
    }
    tl.setSecret(token);

    let auth = nerfed + ':_authToken=' + token + lineEnd;
    auth += nerfed + ':always-auth=true' + lineEnd;

    return new NpmRegistry(url, auth, false);
}
