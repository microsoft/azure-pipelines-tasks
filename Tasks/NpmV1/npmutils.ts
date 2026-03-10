import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as URL from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as ini from 'ini';
import { INpmRegistry } from './npmregistry';

export function toNerfDart(registryUrl: string): string {
    const parsed = URL.parse(registryUrl);
    const host = (parsed.host || '').toLowerCase();
    let pathname = parsed.pathname || '/';
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }
    return `//${host}${pathname}`;
}

export function normalizeRegistry(registryUrl: string): string {
    if (registryUrl && !registryUrl.endsWith('/')) {
        registryUrl += '/';
    }
    return registryUrl;
}

export function getTempNpmrcPath(): string {
    const id: string = tl.getVariable('Build.BuildId') || tl.getVariable('Release.ReleaseId');
    return path.join(getTempPath(), `${id}.npmrc`);
}

export function getTempPath(): string {
    const tempNpmrcDir = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.TempDirectory');
    const tempPath = path.join(tempNpmrcDir, 'npm');
    if (tl.exist(tempPath) === false) {
        tl.mkdirP(tempPath);
    }
    return tempPath;
}

export function appendToNpmrc(npmrcPath: string, content: string): void {
    tl.writeFile(npmrcPath, content, { flag: 'a' } as any);
}

export function getRegistriesFromNpmrc(npmrcPath: string): string[] {
    if (!fs.existsSync(npmrcPath)) {
        tl.debug(`npmrc file not found: ${npmrcPath}`);
        return [];
    }

    const config = ini.parse(fs.readFileSync(npmrcPath).toString());
    const registries: string[] = [];

    for (const key in config) {
        const colonIndex = key.indexOf(':');
        if (key.substring(colonIndex + 1).toLowerCase() === 'registry') {
            config[key] = normalizeRegistry(config[key]);
            registries.push(config[key]);
        }
    }

    return registries;
}

// Discovers registries from the project .npmrc (workingDirectory/.npmrc)
// that match the org's packaging hosts, and authenticates them with System.AccessToken.
export function resolveInternalFeedCredentials(workingDirectory: string, packagingUris: string[]): INpmRegistry[] {
    const projectNpmrcPath = path.join(workingDirectory, '.npmrc');
    
    if (!fs.existsSync(projectNpmrcPath)) {
        return [];
    }

    const packagingHosts = packagingUris
        .map(uri => {
            try {
                return new URL.URL(uri).host.toLowerCase();
            } catch {
                return undefined;
            }
        })
        .filter((host): host is string => host !== undefined);

    const allRegistries = getRegistriesFromNpmrc(projectNpmrcPath);
    const localRegistries = allRegistries.filter(registryUrl => {
        try {
            const host = new URL.URL(registryUrl).host.toLowerCase();
            return packagingHosts.includes(host);
        } catch {
            return false;
        }
    });

    tl.debug(`Found ${localRegistries.length} local npm registries`);

    return localRegistries.map(registryUrl => {
        const nerfed = toNerfDart(registryUrl);
        const accessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
        if (!accessToken) {
            throw new Error('Could not get access token for Azure DevOps service connection');
        }
        tl.setSecret(accessToken);
        return {
            url: registryUrl,
            auth: `${nerfed}:_authToken=${accessToken}`,
            authOnly: true
        };
    });
}

export function saveFile(file: string): void {
    if (file && tl.exist(file)) {
        const tempPath = getTempPath();
        const baseName = path.basename(file);
        const destination = path.join(tempPath, baseName);
        tl.debug(tl.loc('SavingFile', file));
        fs.copyFileSync(file, destination);
    }
}

export function restoreFile(file: string): void {
    if (file) {
        const tempPath = getTempPath();
        const baseName = path.basename(file);
        const source = path.join(tempPath, baseName);
        if (tl.exist(source)) {
            tl.debug(tl.loc('RestoringFile', file));
            fs.copyFileSync(source, file);
            tl.rmRF(source);
        }
    }
}

export function getProjectAndFeedIdFromInputParam(inputParam: string): { feedId: string, projectId: string | null } {
    const feedProject = tl.getInput(inputParam);
    return getProjectAndFeedIdFromInput(feedProject);
}

export function getProjectAndFeedIdFromInput(feedProject: string): { feedId: string, projectId: string | null } {
    let projectId: string | null = null;
    let feedId = feedProject;
    if (feedProject && feedProject.includes('/')) {
        const feedProjectParts = feedProject.split('/');
        projectId = feedProjectParts[0] || null;
        feedId = feedProjectParts[1];
    }
    return { feedId, projectId };
}

export function logError(error: any): void {
    if (error instanceof Error) {
        if (error.message) { tl.debug(error.message); }
        if (error.stack) { tl.debug(error.stack); }
    } else {
        tl.debug(`Error: ${error}`);
    }
}
