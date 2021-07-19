import * as path from 'path';
import * as url from 'url';

import * as util from '../util';

import * as tl from 'azure-pipelines-task-lib/task';

import { INpmRegistry, NpmRegistry } from './npmregistry';
import * as NpmrcParser from './npmrcparser';

export function appendToNpmrc(npmrc: string, data: string): void {
    tl.writeFile(npmrc, data, {
        flag: 'a'
    });
}

export async function getLocalRegistries(packagingUrls: string[], npmrc: string): Promise<string[]> {
    const collectionHosts = packagingUrls.map((pkgUrl: string) => {
        const parsedUrl = url.parse(pkgUrl);
        if (parsedUrl && parsedUrl.host) {
            return parsedUrl.host.toLowerCase();
        }
        return undefined;
    });

    const registries = NpmrcParser.GetRegistries(npmrc, /* saveNormalizedRegistries */ true);

    const localRegistries = registries.filter(registry => {
        const registryUrl = url.parse(registry);
        if(registryUrl && registryUrl.host) {
            return collectionHosts.indexOf(registryUrl.host.toLowerCase()) >= 0;
        }
        return undefined;
    });

    tl.debug(tl.loc('FoundLocalRegistries', localRegistries.length));
    return localRegistries;
}

export function getFeedIdFromRegistry(registry: string) {
    const registryUrl = url.parse(registry);
    const registryPathname = registryUrl.pathname.toLowerCase();
    const startingToken = '/_packaging/';
    const startingIndex = registryPathname.indexOf(startingToken);
    const endingIndex = registryPathname.indexOf('/npm/registry');

    return registryUrl.pathname.substring(startingIndex + startingToken.length, endingIndex);
}

export function getAllNpmRegistries(npmrcPath: string): string[] {
    if (tl.exist(npmrcPath)) {
        return NpmrcParser.GetRegistries(npmrcPath, /* saveNormalizedRegistries */ false);
    }

    return [];
}

export async function getLocalNpmRegistries(workingDir: string, packagingUrls: string[]): Promise<INpmRegistry[]> {
    const npmrcPath = path.join(workingDir, '.npmrc');

    if (tl.exist(npmrcPath)) {
        const localRegistries = await getLocalRegistries(packagingUrls, npmrcPath);
        return localRegistries.map(registry => NpmRegistry.FromUrl(registry, true));
    }

    return [];
}

export function getTempNpmrcPath(): string {
    const id: string = tl.getVariable('Build.BuildId') || tl.getVariable('Release.ReleaseId');
    const tempUserNpmrcPath: string = path.join(util.getTempPath(), `${id}.npmrc`);

    return tempUserNpmrcPath;
}
