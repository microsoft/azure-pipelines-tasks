import * as tl from 'vsts-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from 'npm-common/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'npm-common/util';

export async function run(command?: string): Promise<void> {
    let workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    let npmrc = util.getTempNpmrcPath();
    let npmRegistry: INpmRegistry = await getPublishRegistry();

    tl.debug(tl.loc('PublishRegistry', npmRegistry.url));
    util.appendToNpmrc(npmrc, `registry=${npmRegistry.url}\n`);
    util.appendToNpmrc(npmrc, `${npmRegistry.auth}\n`);

    // For publish, always override their project .npmrc
    let npm = new NpmToolRunner(workingDir, npmrc, true);
    npm.line('publish');

    npm.execSync();

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}

export async function getPublishRegistry(): Promise<INpmRegistry>{
    let npmRegistry: INpmRegistry;
    let registryLocation = tl.getInput(NpmTaskInput.PublishRegistry);
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('PublishFeed'));
            let feedId = tl.getInput(NpmTaskInput.PublishFeed, true);
            npmRegistry = await NpmRegistry.FromFeedId(feedId);
            break;
        case RegistryLocation.External:
            tl.debug(tl.loc('PublishExternal'));
            let endpointId = tl.getInput(NpmTaskInput.PublishEndpoint, true);
            npmRegistry = NpmRegistry.FromServiceEndpoint(endpointId);
            break;
    }
    return npmRegistry;
}