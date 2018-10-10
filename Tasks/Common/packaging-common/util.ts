import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

import * as tl from 'vsts-task-lib/task';
import * as vsts from 'vso-node-api/WebApi';

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

export async function getFeedRegistryUrl(packagingUrl: string, feedId: string): Promise<string> {
    const apiVersion = '3.0-preview.1';
    const area = 'npm';
    const locationId = 'D9B75B07-F1D9-4A67-AAA6-A4D9E66B3352';

    const accessToken = getSystemAccessToken();
    const credentialHandler = vsts.getBearerHandler(accessToken);
    const vssConnection = new vsts.WebApi(packagingUrl, credentialHandler);
    const coreApi = vssConnection.getCoreApi();

    const data = await Retry(async () => {
        return await coreApi.vsoClient.getVersioningData(apiVersion, area, locationId, { feedId: feedId });
    }, 4, 100);

    return data.requestUrl;
}

// This should be replaced when retry is implemented in vso client.
async function Retry<T>(cb : () => Promise<T>, max_retry: number, retry_delay: number) : Promise<T> {
    try {
        return await cb();
    } catch(exception) {
        tl.debug(JSON.stringify(exception));
        if(max_retry > 0)
        {
            tl.debug("Waiting " + retry_delay + "ms...");
            await delay(retry_delay);
            tl.debug("Retrying...");
            return await Retry<T>(cb, max_retry-1, retry_delay*2);
        } else {
            throw exception;
        }
    }
}
function delay(delayMs:number) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, delayMs);
    });
 }
