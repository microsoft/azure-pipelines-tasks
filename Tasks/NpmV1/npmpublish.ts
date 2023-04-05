import * as tl from 'azure-pipelines-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from 'azure-pipelines-tasks-packaging-common/npm/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import { PackagingLocation } from 'azure-pipelines-tasks-packaging-common/locationUtilities';

export async function run(packagingLocation: PackagingLocation): Promise<void> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmrc = npmutil.getTempNpmrcPath();
    const npmRegistry: INpmRegistry = await getPublishRegistry(packagingLocation);

    tl.debug(tl.loc('PublishRegistry', npmRegistry.url));
    npmutil.appendToNpmrc(npmrc, `registry=${npmRegistry.url}\n`);
    npmutil.appendToNpmrc(npmrc, `${npmRegistry.auth}\n`);

    // For publish, always override their project .npmrc
    const npm = new NpmToolRunner(workingDir, npmrc, true);
    npm.line('publish');

    npm.execSync();

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}

export async function getPublishRegistry(packagingLocation: PackagingLocation): Promise<INpmRegistry> {
    let npmRegistry: INpmRegistry;
    const registryLocation = tl.getInput(NpmTaskInput.PublishRegistry) || null;
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('PublishFeed'));
            const feed = util.getProjectAndFeedIdFromInputParam(NpmTaskInput.PublishFeed);
            npmRegistry = await NpmRegistry.FromFeedId(
                packagingLocation.DefaultPackagingUri,
                feed.feedId,
                feed.projectId,
                false /* authOnly */,
                true /* useSession */);
            break;
        case RegistryLocation.External:
            tl.debug(tl.loc('PublishExternal'));
            const endpointId = tl.getInput(NpmTaskInput.PublishEndpoint, true);
            npmRegistry = await NpmRegistry.FromServiceEndpoint(endpointId);
            break;
    }
    return npmRegistry;
}