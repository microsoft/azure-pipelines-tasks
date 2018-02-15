import * as path from 'path';

import * as tl from 'vsts-task-lib/task';

import { NpmCommand, NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from 'npm-common/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'npm-common/util';

export async function run(command?: string): Promise<void> {
    let workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    let npmrc = util.getTempNpmrcPath();
    let npmRegistries: INpmRegistry[] = await getCustomRegistries();
    let registryLocation = tl.getInput(NpmTaskInput.CustomRegistry);
    let overrideNpmrc = (tl.getInput(NpmTaskInput.CustomRegistry) == RegistryLocation.Feed) ? true : false;

    for (let registry of npmRegistries) {
        if (registry.authOnly === false) {
            tl.debug(tl.loc('UsingRegistry', registry.url));
            util.appendToNpmrc(npmrc, `registry=${registry.url}\n`);
        }

        tl.debug(tl.loc('AddingAuthRegistry', registry.url));
        util.appendToNpmrc(npmrc, `${registry.auth}\n`);
    }

    let npm = new NpmToolRunner(workingDir, npmrc, overrideNpmrc);
    npm.line(command || tl.getInput(NpmTaskInput.CustomCommand, true));

    npm.execSync();

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}

export async function getCustomRegistries(): Promise<NpmRegistry[]> {
    let workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    let npmRegistries: INpmRegistry[] = await util.getLocalNpmRegistries(workingDir);
    let registryLocation = tl.getInput(NpmTaskInput.CustomRegistry);
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('UseFeed'));
            let feedId = tl.getInput(NpmTaskInput.CustomFeed, true);
            npmRegistries.push(await NpmRegistry.FromFeedId(feedId));
            break;
        case RegistryLocation.Npmrc:
            tl.debug(tl.loc('UseNpmrc'));
            let endpointIds = tl.getDelimitedInput(NpmTaskInput.CustomEndpoint, ',');
            if (endpointIds && endpointIds.length > 0) {
                let endpointRegistries = endpointIds.map(e => NpmRegistry.FromServiceEndpoint(e, true));
                npmRegistries = npmRegistries.concat(endpointRegistries);
            }
            break;
    }
    return npmRegistries;
}
