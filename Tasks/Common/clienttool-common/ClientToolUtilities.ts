import AdmZip = require('adm-zip');
import * as vsts from 'azure-devops-node-api';
import os = require("os");
import * as path from "path";
import * as tl from "azure-pipelines-task-lib";
import * as toollib from "azure-pipelines-tool-lib/tool";
import { IRequestOptions } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';


export function getClientToolLocation(dirName: string, toolName: string): string {
    let toolPath: string = path.join(dirName, toolName);
    return toolPath;
}

// This function is to apply retries generically for any unreliable network calls
export async function retryOnExceptionHelper<T>(action: () => Promise<T>, maxTries: number, retryIntervalInMilliseconds: number): Promise<T> {
    while (true) {
        try {
            return await action();
        } catch (error) {
            maxTries--;
            if (maxTries < 1) {
                throw error;
            }
            tl.debug(`Network call failed. Number of retries left: ${maxTries}`);
            if (error) { tl.debug(error); }
            await delay(retryIntervalInMilliseconds);
        }
    }
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getSystemAccessToken(): string {
    tl.debug('Getting credentials for client tool');
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return auth.parameters['AccessToken'];
    } else {
        tl.warning('Could not determine credentials to use');
    }
}

function _createExtractFolder(toolName: string, dest?: string,): string {
    if (!dest) {
        // create a temp dir
        dest = path.join(tl.getVariable("Agent.TempDirectory"), toolName);
    }
    tl.mkdirP(dest);
    return dest;
}

export function getSupportedArchitecture(): string {
    let architecture = os.arch();

    if (architecture === "x64") {
        architecture = "amd64";
    }

    // https://github.com/nodejs/node-v0.x-archive/issues/2862
    if (architecture == "ia32") {
        if (process.env.PROCESSOR_ARCHITEW6432 != null && process.env.PROCESSOR_ARCHITEW6432.toUpperCase() === "AMD64") {
            architecture = "amd64";
        }
    }

    if (architecture.toLowerCase() !== "amd64") {
        throw new Error(`The processing architecture of ${architecture} is not supported.`);
    }

    return architecture;
}

export function getSupportedOSType(): string {

    switch (tl.osType()) {
        case 'Linux':
            return 'linux';

        case 'Windows_NT':
            return 'windows';

        case 'Darwin':
            return 'darwin';

        default:
            throw Error('Not Supported OS type');
    }
}

// there is a reason we do this instead of toollib.extractZip, but we don't recall what it is
// (might be Mac compatibility)
export async function extractZip(file: string, toolName: string): Promise<string> {
    if (!file) {
        throw new Error("parameter 'file' is required");
    }
    let dest = _createExtractFolder(toolName);
    let zip = new AdmZip(file);
    zip.extractAllTo(dest, true);
    return dest;
}

export async function getClientToolFromService(serviceUri: string, accessToken: string, toolName: string) {

    let osName = getSupportedOSType();
    let arch = getSupportedArchitecture();

    const overrideClientToolPath = tl.getVariable(toolName + ".OverrideClientToolPath");
    if (overrideClientToolPath != null) {
        return getClientToolLocation(overrideClientToolPath, toolName);
    }

    const blobstoreAreaName = "clienttools";
    const blobstoreAreaId = "187ec90d-dd1e-4ec6-8c57-937d979261e5";
    const ApiVersion = "5.0-preview";

    const blobstoreConnection = getWebApiWithProxy(serviceUri, accessToken);

    const clientToolGetUrl = await blobstoreConnection.vsoClient.getVersioningData(ApiVersion, blobstoreAreaName, blobstoreAreaId, { toolName }, { osName, arch });

    const clientToolUri = await blobstoreConnection.rest.get(clientToolGetUrl.requestUrl);

    if (clientToolUri.statusCode !== 200) {
        let errorMessage = `Could not get tool metadata from ${clientToolGetUrl.requestUrl} due to error (${clientToolUri.result.toString()}).`
        tl.debug(errorMessage);
        throw new Error(errorMessage);
    }

    let clientToolPath = toollib.findLocalTool(toolName, clientToolUri.result['version']);
    if (!clientToolPath) {
        tl.debug(`Downloading client tool from ${clientToolUri.result['uri']}.`);

        const zippedToolsDir: string = await retryOnExceptionHelper(() => toollib.downloadTool(clientToolUri.result['uri']), 3, 1000);

        tl.debug("Downloaded zipped client tool to " + zippedToolsDir);
        const unzippedToolsDir = await extractZip(zippedToolsDir, toolName);

        clientToolPath = await toollib.cacheDir(unzippedToolsDir, toolName, clientToolUri.result['version']);
    } else {
        tl.debug(`Client tool already found at ${clientToolPath}.`);
    }
    return getClientToolLocation(clientToolPath, toolName);
}

// trim the given character if it exists in the end of string.
export function trimEnd(data: string, trimChar: string) {
    if (!trimChar || !data) {
        return data;
    }

    if (data.endsWith(trimChar)) {
        return data.substring(0, data.length - trimChar.length);
    } else {
        return data;
    }
}

export function getWebApiWithProxy(serviceUri: string, accessToken?: string): vsts.WebApi {
    if (!accessToken) {
        accessToken = getSystemAccessToken();
    }

    const credentialHandler = vsts.getBasicHandler('vsts', accessToken);
    const options: IRequestOptions = {
        proxy: tl.getHttpProxyConfiguration(serviceUri),
        allowRetries: true,
        maxRetries: 5
    };
    const webApi = new vsts.WebApi(serviceUri, credentialHandler, options);
    tl.debug(`Created webApi client for ${serviceUri}; options: ${JSON.stringify(options)}`);
    return webApi;
}

export async function getBlobstoreUriFromBaseServiceUri(serviceUri: string, accesstoken: string): Promise<string> {
    const blobAreaId = '5294ef93-12a1-4d13-8671-9d9d014072c8';

    return getServiceUriFromAreaId(serviceUri, accesstoken, blobAreaId);
}

// Getting service urls from resource areas api
export async function getServiceUriFromAreaId(serviceUri: string, accessToken: string, areaId: string): Promise<string> {
    const serverType = tl.getVariable('System.ServerType');
    if (!serverType || serverType.toLowerCase() !== 'hosted') {
        return serviceUri;
    }

    const webApi = getWebApiWithProxy(serviceUri, accessToken);
    const locationApi = await webApi.getLocationsApi();

    tl.debug(`Getting URI for area ID ${areaId} from ${serviceUri}`);
    const resourceArea = await retryOnExceptionHelper(() => locationApi.getResourceArea(areaId), 3, 1000);
    tl.debug(`Found resource area with locationUrl: ${resourceArea && resourceArea.locationUrl}`);

    return resourceArea.locationUrl;
}
