import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

import * as tl from 'vsts-task-lib/task';
import * as vsts from 'vso-node-api/WebApi';

import { INpmRegistry, NpmRegistry } from './npmregistry';
import * as NpmrcParser from './npmrcparser';

import * as locationUtilities from 'utility-common/packaging/locationUtilities';
import * as provenance from 'utility-common/packaging/provenance';

export function appendToNpmrc(npmrc: string, data: string): void {
    tl.writeFile(npmrc, data, {
        flag: 'a'
    } as tl.FsOptions);
}

export async function getLocalRegistries(packagingUrls: string[], npmrc: string): Promise<string[]> {
    const collectionHosts = packagingUrls.map((pkgUrl: string) => {
        const parsedUrl = url.parse(pkgUrl);
        if (parsedUrl) {
            return parsedUrl.host.toLowerCase();
        }
        return undefined;
    });

    const registries = NpmrcParser.GetRegistries(npmrc);

    const localRegistries = registries.filter(registry => {
        const registryHost = url.parse(registry).host;
        return collectionHosts.indexOf(registryHost.toLowerCase()) >= 0;
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
    const tempUserNpmrcPath: string = path.join(getTempPath(), `${id}.npmrc`);

    return tempUserNpmrcPath;
}

export function getTempPath(): string {
    const tempNpmrcDir
        = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.ReleaseDirectory')
        || process.cwd();
        const tempPath = path.join(tempNpmrcDir, 'npm');
    if (tl.exist(tempPath) === false) {
        tl.mkdirP(tempPath);
    }

    return tempPath;
}

function copyFile(src: string, dst: string): void {
    const content = fs.readFileSync(src);
    fs.writeFileSync(dst, content);
}

export function saveFile(file: string): void {
    if (file && tl.exist(file)) {
        const tempPath = getTempPath();
        const baseName = path.basename(file);
        const destination = path.join(tempPath, baseName);

        tl.debug(tl.loc('SavingFile', file));
        copyFile(file, destination);
    }
}

export function saveFileWithName(file: string, name: string, filePath: string): void {
    if (file && tl.exist(file)) {
        const destination = path.join(filePath, name + '.npmrc');
        tl.debug(tl.loc('SavingFile', file));
        copyFile(file, destination);
    }
}

export function restoreFile(file: string): void {
    if (file) {
        const tempPath = getTempPath();
        const baseName = path.basename(file);
        const source = path.join(tempPath, baseName);

        if (tl.exist(source)) {
            tl.debug(tl.loc('RestoringFile', file));
            copyFile(source, file);
            tl.rmRF(source);
        }
    }
}

export function restoreFileWithName(file: string, name: string, filePath: string): void {
    if (file) {
        const source = path.join(filePath, name + '.npmrc');
        if (tl.exist(source)) {
            tl.debug(tl.loc('RestoringFile', file));
            copyFile(source, file);
            tl.rmRF(source);
        }
    }
}

export function getSystemAccessToken(): string {
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
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

export async function CreateSession(packagingUrl: string, feedId: string): Promise<provenance.SessionResponse> {
    tl.debug("creating session");

    var sessionRequest: provenance.SessionRequest = {
        feed: feedId,
        source: "Build",
        data: {}
    }

    const vssConnection = locationUtilities.getWebApiWithProxy(packagingUrl);
    const prov = new provenance.ProvenanceApi(vssConnection.serverUrl, [vssConnection.authHandler], vssConnection.options)
    return await prov.createSession("npm", sessionRequest);
}

export async function getFeedRegistryUrl(packagingUrl: string, feedId: string): Promise<string> {

    const sessionResponse = await CreateSession(packagingUrl, feedId);
    const sessionId = sessionResponse.sessionId;

    const apiVersion = '3.0-preview.1';
    const area = 'npm';
    const locationId = 'D9B75B07-F1D9-4A67-AAA6-A4D9E66B3352';

    const vssConnection = locationUtilities.getWebApiWithProxy(packagingUrl);

    const data = await locationUtilities.Retry(async () => {
        return await vssConnection.vsoClient.getVersioningData(apiVersion, area, locationId, { feedId: sessionId });
    }, 4, 100);

    return data.requestUrl;
}
