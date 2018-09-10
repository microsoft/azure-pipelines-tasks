import * as tl from 'vsts-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from 'npm-common/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'npm-common/util';
import { PackagingLocation } from 'utility-common/packaging/locationUtilities';

export async function run(packagingLocation: PackagingLocation): Promise<void> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmrc = util.getTempNpmrcPath();
    const npmRegistry: INpmRegistry = await getPublishRegistry(packagingLocation);

    tl.debug(tl.loc('PublishRegistry', npmRegistry.url));
    util.appendToNpmrc(npmrc, `registry=${npmRegistry.url}\n`);
    util.appendToNpmrc(npmrc, `${npmRegistry.auth}\n`);

    // For publish, always override their project .npmrc
    const npm = new NpmToolRunner(workingDir, npmrc, true);
    npm.line('publish');

    npm.execSync();

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}

export async function getPublishRegistry(packagingLocation: PackagingLocation): Promise<INpmRegistry> {
    let npmRegistry: INpmRegistry;
    const registryLocation = tl.getInput(NpmTaskInput.PublishRegistry);
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('PublishFeed'));
            const feedId = tl.getInput(NpmTaskInput.PublishFeed, true);
            npmRegistry = await NpmRegistry.FromFeedId(packagingLocation.DefaultPackagingUri, feedId);
            break;
        case RegistryLocation.External:
            tl.debug(tl.loc('PublishExternal'));
            const endpointId = tl.getInput(NpmTaskInput.PublishEndpoint, true);
            npmRegistry = await NpmRegistry.FromServiceEndpoint(endpointId);
            break;
    }
    return npmRegistry;
}