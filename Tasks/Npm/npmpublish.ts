import * as tl from 'vsts-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from './npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from './util';

export async function run(command?: string): Promise<void> {
    let workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    let npmrc = util.getTempNpmrcPath();
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

    tl.debug(tl.loc('PublishRegistry', npmRegistry.url));
    util.appendToNpmrc(npmrc, `registry=${npmRegistry.url}\n`);
    util.appendToNpmrc(npmrc, `${npmRegistry.auth}\n`);

    let npm = new NpmToolRunner(workingDir, npmrc);
    npm.line('publish');

    // We delete their project .npmrc so it won't override our user .npmrc
    const projectNpmrc = `${workingDir}\\.npmrc`;
    util.saveFile(projectNpmrc);
    tl.rmRF(projectNpmrc);

    await npm.exec();
    util.restoreFile(projectNpmrc);

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}
