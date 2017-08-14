import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';
import * as url from 'url';

import * as tl from 'vsts-task-lib/task';
import * as vsts from 'vso-node-api/WebApi';

import { INpmRegistry, NpmRegistry } from './npmregistry';
import * as NpmrcParser from './npmrcparser';

export function appendToNpmrc(npmrc: string, data: string): void {
    tl.writeFile(npmrc, data, {
        flag: 'a'
    } as tl.FsOptions);
}

export async function getLocalRegistries(npmrc: string): Promise<string[]> {
    let localRegistries: string[] = [];
    let registries = NpmrcParser.GetRegistries(npmrc);
    let collectionUrl = url.parse(await getPackagingCollectionUrl());

    for (let registry of registries) {
        let registryUrl = url.parse(registry);
        if (registryUrl.host.toLowerCase() === collectionUrl.host.toLowerCase()) {
            localRegistries.push(registry);
        }
    }

    tl.debug(tl.loc('FoundLocalRegistries', localRegistries.length));
    return localRegistries;
}

export function getFeedIdFromRegistry(registry: string) {
    let registryUrl = url.parse(registry);
    let registryPathname = registryUrl.pathname.toLowerCase();
    let startingToken = '/_packaging/';
    let startingIndex = registryPathname.indexOf(startingToken);
    let endingIndex = registryPathname.indexOf('/npm/registry');

    return registryUrl.pathname.substring(startingIndex + startingToken.length, endingIndex);
}

export async function getLocalNpmRegistries(workingDir: string): Promise<INpmRegistry[]> {
    let localNpmRegistries: INpmRegistry[] = [];
    let npmrcPath = path.join(workingDir, '.npmrc');

    if (tl.exist(npmrcPath)) {
        let npmRegistries: INpmRegistry[] = [];
        for (let registry of await getLocalRegistries(npmrcPath)) {
            npmRegistries.push(await NpmRegistry.FromFeedId(getFeedIdFromRegistry(registry), true));
        }

        localNpmRegistries = localNpmRegistries.concat(npmRegistries);
    }

    return localNpmRegistries;
}

export async function getPackagingCollectionUrl(): Promise<string> {
    let forcedUrl = tl.getVariable('Npm.PackagingCollectionUrl');
    if (forcedUrl) {
        let testUrl = url.parse(forcedUrl);
        tl.debug(tl.loc('ForcePackagingUrl', forcedUrl));
        return Q(url.format(testUrl));
    }

    let collectionUrl = url.parse(tl.getVariable('System.TeamFoundationCollectionUri'));

    if (collectionUrl.hostname.toUpperCase().endsWith('.VISUALSTUDIO.COM')) {
        let hostParts = collectionUrl.hostname.split('.');
        let packagingHostName = hostParts[0] + '.pkgs.visualstudio.com';
        collectionUrl.hostname = packagingHostName;
        // remove the host property so it doesn't override the hostname property for url.format
        delete collectionUrl.host;
    }

    return Q(url.format(collectionUrl));
}

export function getTempNpmrcPath(): string {
    let id: string = tl.getVariable('Build.BuildId') || tl.getVariable('Release.ReleaseId');
    let tempUserNpmrcPath: string = path.join(getTempPath(), `${id}.npmrc`);

    return tempUserNpmrcPath;
}

export function getTempPath(): string {
    let tempNpmrcDir
        = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.ReleaseDirectory')
        || process.cwd();
    let tempPath = path.join(tempNpmrcDir, 'npm');
    if (tl.exist(tempPath) === false) {
        tl.mkdirP(tempPath);
    }

    return tempPath;
}

function copyFile(src: string, dst: string): void {
    let content = fs.readFileSync(src);
    fs.writeFileSync(dst, content);
}

export function saveFile(file: string): void {
    if (file && tl.exist(file)) {
        let tempPath = getTempPath();
        let baseName = path.basename(file);
        let destination = path.join(tempPath, baseName);

        tl.debug(tl.loc('SavingFile', file));
        copyFile(file, destination);
    }
}

export function saveFileWithName(file: string, name: string, filePath: string): void {
    if (file && tl.exist(file)) {
        let destination = path.join(filePath, name + '.npmrc');
        tl.debug(tl.loc('SavingFile', file));
        copyFile(file, destination);
    }
}

export function restoreFile(file: string): void {
    if (file) {
        let tempPath = getTempPath();
        let baseName = path.basename(file);
        let source = path.join(tempPath, baseName);

        if (tl.exist(source)) {
            tl.debug(tl.loc('RestoringFile', file));
            copyFile(source, file);
            tl.rmRF(source);
        }
    }
}

export function restoreFileWithName(file: string, name: string, filePath: string): void {
    if (file) {
        let source = path.join(filePath, name + '.npmrc');
        if (tl.exist(source)) {
            tl.debug(tl.loc('RestoringFile', file));
            copyFile(source, file);
            tl.rmRF(source);
        }
    }
}

export function getSystemAccessToken(): string {
    let auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug(tl.loc('FoundBuildCredentials'));
        return auth.parameters['AccessToken'];
    } else {
        tl.warning(tl.loc('NoBuildCredentials'));
    }

    return undefined;
}

export function toNerfDart(uri: string): string {
    var parsed = url.parse(uri);
    delete parsed.protocol;
    delete parsed.auth;
    delete parsed.query;
    delete parsed.search;
    delete parsed.hash;

    return url.resolve(url.format(parsed), '.');
}

export async function getFeedRegistryUrl(feedId: string): Promise<string> {
    const apiVersion = '3.0-preview.1';
    const area = 'npm';
    const locationId = 'D9B75B07-F1D9-4A67-AAA6-A4D9E66B3352';

    let accessToken = getSystemAccessToken();
    let credentialHandler = vsts.getBearerHandler(accessToken);
    let collectionUrl = await getPackagingCollectionUrl();
    let vssConnection = new vsts.WebApi(collectionUrl, credentialHandler);
    let coreApi = vssConnection.getCoreApi();
    let data = await coreApi.vsoClient.getVersioningData(apiVersion, area, locationId, { feedId: feedId });

    return data.requestUrl;
}
