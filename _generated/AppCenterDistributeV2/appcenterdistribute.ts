import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import os = require('os');
import { HttpClient } from 'typed-rest-client/HttpClient';
import { IHttpClientResponse } from "typed-rest-client/Interfaces";
import utils = require('./utils');
import { AzureBlobUploadHelper } from './azure-blob-upload-helper';
import { inspect } from 'util';

import {
    ACFile,
    ACFusNodeUploader,
    ACFusMessageLevel,
    ACFusUploader,
    ACFusUploadState,
    IProgress,
    LogProperties,
    IUploadStats,
    IInitializeSettings,
} from "appcenter-file-upload-client-node";

let mcFusUploader: ACFusUploader = null;

class UploadInfo {
    id: string;
    package_asset_id: string;
    url_encoded_token: string;
    upload_domain: string;
}

class SymbolsUploadInfo {
    symbol_upload_id: string;
    upload_url: string;
    expiration_date: string;
}

function getEndpointDetails(endpointInputFieldName) {
    var errorMessage = tl.loc("CannotDecodeEndpoint");
    var endpoint = tl.getInput(endpointInputFieldName, true);

    if (!endpoint) {
        throw new Error(errorMessage);
    }

    let url = tl.getEndpointUrl(endpoint, false);
    let apiServer = url.substr(0, url.lastIndexOf('/'));
    let apiVersion = url.substr(url.lastIndexOf('/') + 1);
    let authToken = tl.getEndpointAuthorizationParameter(endpoint, 'apitoken', false);

    return {
        apiServer: apiServer,
        apiVersion: apiVersion,
        authToken: authToken
    };
}

async function handleResponse(response: IHttpClientResponse): Promise<{ response: IHttpClientResponse, body?: any }> {
    const { statusCode } = response.message;
    tl.debug(`---- http call status code: ${statusCode}`);
    const bodyStr: string = await response.readBody();
    if (statusCode < 200 || statusCode >= 300) {
        const statusCodeMsg = `http response code: ${statusCode}`;
        const message = bodyStr ? `${bodyStr} ${os.EOL}${statusCodeMsg}` : statusCodeMsg;
        tl.debug(`---- Failed with error: ${message}`);
        throw new Error(message);
    }
    tl.debug(`---- http call ${bodyStr}`);
    let body = bodyStr;
    if (bodyStr) {
        tl.debug(`---- ${bodyStr}`);
        try {
            body = JSON.parse(bodyStr);
        } catch (err) {

        }
    }
    return Promise.resolve({ response, body });
}

function getClient(options: any) {
    return new HttpClient('AppCenterDistribute', null, options);
}

async function beginReleaseUpload(apiServer: string, apiVersion: string, appSlug: string, token: string, userAgent: string): Promise<UploadInfo> {
    tl.debug("-- Prepare for uploading release.");
    const beginUploadUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/uploads/releases`;
    tl.debug(`---- url: ${beginUploadUrl}`);
    const headers = {
        "Content-Type": "application/json",
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    const { body } = await getClient({ headers }).post(beginUploadUrl, null).then(handleResponse);
    if (!body.package_asset_id) {
        throw new Error(`failed to create release upload. ${body.message}`);
    }
    return body;
}

async function abortReleaseUpload(apiServer: string, apiVersion: string, appSlug: string, upload_id: string, token: string, userAgent: string) {
    tl.debug("-- Aborting release...");
    const patchReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/release_uploads/${upload_id}`;
    tl.debug(`---- url: ${patchReleaseUrl}`);
    const headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS",
        "content-type": "application/json"
    };
    try {
        await getClient({ headers })
            .patch(patchReleaseUrl, JSON.stringify({ "status": "aborted" }), headers)
            .then(handleResponse);
    } catch (err) {
        return Promise.reject(`Failed to abort release upload: ${err}`);
    }
}

/**
 * Uploads a the binary to App Center using appcenter-file-upload-client.
 * @param releaseUploadParams release params from "beginReleaseUpload" call.
 * @param file path to the file to be uploaded.
 * @returns {Promise<any>} - the promise is resolved once the upload has been reported as completed.
*/
async function uploadRelease(releaseUploadParams: UploadInfo, file: string) {
    const assetId = releaseUploadParams.package_asset_id;
    const urlEncodedToken = releaseUploadParams.url_encoded_token;
    const uploadDomain = releaseUploadParams.upload_domain;
    tl.debug("-- Uploading release...");
    return new Promise((resolve, reject) => {
        const uploadSettings: IInitializeSettings = {
            assetId: assetId,
            urlEncodedToken: urlEncodedToken,
            uploadDomain: uploadDomain,
            tenant: "distribution",
            onProgressChanged: (progress: IProgress) => {
                tl.debug("---- onProgressChanged: " + progress.percentCompleted);
            },
            onMessage: (message: string, properties: LogProperties, level: ACFusMessageLevel) => {
                tl.debug(`---- onMessage: ${message} \nMessage properties: ${JSON.stringify(properties)}`);
                if (level === ACFusMessageLevel.Error) {
                    mcFusUploader.cancel();
                    reject(new Error(`Uploading file error: ${message}`));
                }
            },
            onStateChanged: (status: ACFusUploadState): void => {
                tl.debug(`---- onStateChanged: ${status.toString()}`);
            },
            onCompleted: (uploadStats: IUploadStats) => {
                tl.debug("---- Upload completed, total time: " + uploadStats.totalTimeInSeconds);
                resolve();
            },
        };
        mcFusUploader = new ACFusNodeUploader(uploadSettings);
        const appFile = new ACFile(file);
        mcFusUploader.start(appFile);
    });
}

async function patchRelease(apiServer: string, apiVersion: string, appSlug: string, upload_id: string, token: string, userAgent: string) {
    tl.debug("-- Finishing uploading release...");
    const patchReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/uploads/releases/${upload_id}`;
    tl.debug(`---- url: ${patchReleaseUrl}`);
    const headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS",
        "content-type": "application/json"
    };
    const { body } = await getClient({ headers })
        .patch(patchReleaseUrl, JSON.stringify({ "upload_status": "uploadFinished" }), headers)
        .then(handleResponse);
    const { upload_status, message } = body;
    if (upload_status !== "uploadFinished") {
        return Promise.reject(`Failed to patch release upload: ${message}`);
    }
    return Promise.resolve();
}

async function publishRelease(publishReleaseUrl: string, isMandatory: boolean, releaseNotes: string, destinationIds: string[], token: string, userAgent: string) {
    tl.debug("-- Mark package available.");
    tl.debug(`---- url: ${publishReleaseUrl}`);

    const headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS",
        "content-type": "application/json"
    };
    const destinations = destinationIds.map(id => { return { "id": id }; });
    let publishBody = {
        "status": "available",
        "release_notes": releaseNotes,
        "mandatory_update": isMandatory,
        "destinations": destinations
    };

    let branchName = process.env['BUILD_SOURCEBRANCH'];
    branchName = getBranchName(branchName);
    const sourceVersion = process.env['BUILD_SOURCEVERSION'];
    const buildId = process.env['BUILD_BUILDID'];

    // Builds started by App Center has the commit message set when distribution is enabled
    const commitMessage = process.env['LASTCOMMITMESSAGE'];
    // Updating the internal_request_source to distinguish the AppCenter triggered build and custom build
    if (!!commitMessage) {
        headers["internal-request-source"] = "VSTS-APPCENTER";
    }

    // Including these information for distribution notification to have additional context
    // Commit message is optional
    if (branchName && sourceVersion) {
        const build = {
            id: buildId,
            branch: branchName,
            commit_hash: sourceVersion
        }

        if (commitMessage) {
            build['commit_message'] = commitMessage;
        }

        publishBody = Object.assign(publishBody, { build: build });
    }

    await getClient({ headers })
        .patch(publishReleaseUrl, JSON.stringify(publishBody), headers)
        .then(handleResponse);
}

function getBranchName(ref: string): string {
    const gitRefsHeadsPrefix = 'refs/heads/';
    if (ref) {
        return ref.indexOf(gitRefsHeadsPrefix) === 0 ? ref.substr(gitRefsHeadsPrefix.length) : ref;
    }
}

/**
 * If the input is a single file, upload this file without any processing.
 * If the input is a single folder, zip it's content. The archive name is the folder's name
 * If the input is a set of folders or files, zip them so they appear on the root of the archive. The archive name is the parent folder's name.
 */
async function prepareSymbols(symbolsPaths: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        tl.debug("-- Prepare symbols");
        if (symbolsPaths.length === 1 && fs.statSync(symbolsPaths[0]).isFile()) {
            tl.debug(`.. a single symbols file: ${symbolsPaths[0]}`)
            // single file - Android source mapping txt file
            resolve(symbolsPaths[0]);
        } else if (symbolsPaths.length > 0) {
            tl.debug(`.. archiving: ${symbolsPaths}`);
            let symbolsRoot = utils.findCommonParent(symbolsPaths);
            let zipPath = utils.getArchivePath(symbolsRoot);
            let zipStream = utils.createZipStream(symbolsPaths, symbolsRoot);
            utils.createZipFile(zipStream, zipPath).then(() => {
                tl.debug(`---- symbols archive file: ${zipPath}`)
                resolve(zipPath);
            });
        } else {
            resolve(null);
        }
    });
}

async function beginSymbolUpload(apiServer: string, apiVersion: string, appSlug: string, symbol_type: string, token: string, userAgent: string): Promise<SymbolsUploadInfo> {
    tl.debug("-- Begin symbols upload");
    const beginSymbolUploadUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/symbol_uploads`;
    tl.debug(`---- url: ${beginSymbolUploadUrl}`);
    const headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS",
        "content-type": "application/json"
    };
    const { body } = await getClient({ headers })
        .post(beginSymbolUploadUrl, JSON.stringify({ "symbol_type": symbol_type }))
        .then(handleResponse);
    const symbolsUploadInfo: SymbolsUploadInfo = {
        symbol_upload_id: body.symbol_upload_id,
        upload_url: body.upload_url,
        expiration_date: body.expiration_date
    }
    return Promise.resolve(symbolsUploadInfo);
}

async function uploadSymbols(uploadUrl: string, file: string): Promise<void> {
    tl.debug("-- Uploading symbols...");
    tl.debug(`---- url: ${uploadUrl}`);
    try {
        const azureBlobUploadHelper = new AzureBlobUploadHelper(tl.debug);
        await azureBlobUploadHelper.upload(uploadUrl, file);
    } catch (e) {
        tl.error(inspect(e));
        throw e;
    }
    tl.debug('-- Symbol uploaded.');
}

async function commitSymbols(apiServer: string, apiVersion: string, appSlug: string, symbol_upload_id: string, token: string, userAgent: string) {
    tl.debug("-- Finishing uploading symbols...");
    let commitSymbolsUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/symbol_uploads/${symbol_upload_id}`;
    tl.debug(`---- url: ${commitSymbolsUrl}`);
    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    await getClient({ headers })
        .patch(commitSymbolsUrl, JSON.stringify({ "status": "committed" }))
        .then(handleResponse);
    return Promise.resolve();
}

function expandSymbolsPaths(symbolsType: string, pattern: string, continueOnError: boolean, packParentFolder: boolean): string[] {
    tl.debug("-- Expanding symbols path pattern to a list of paths");

    let symbolsPaths: string[] = [];

    if (symbolsType === "Apple") {
        // User can specifay a symbols path pattern that selects
        // multiple dSYM folder paths for Apple application.
        let dsymPaths = utils.resolvePaths(pattern, continueOnError, packParentFolder);

        // Resolved paths can be null if continueIfSymbolsNotFound is true and the file/folder does not exist.
        if (dsymPaths) {
            dsymPaths.forEach(dsymFolder => {
                if (dsymFolder) {
                    let folderPath = utils.checkAndFixFilePath(dsymFolder, continueOnError);
                    // The path can be null if continueIfSymbolsNotFound is true and the folder does not exist.
                    if (folderPath) {
                        symbolsPaths.push(folderPath);
                    }
                }
            })
        }
    } else if (symbolsType === "UWP") {
        // User can specifay a symbols path pattern that selects
        // multiple PDB paths for UWP application.
        let pdbPaths = utils.resolvePaths(pattern, continueOnError, packParentFolder);

        // Resolved paths can be null if continueIfSymbolsNotFound is true and the file/folder does not exist.
        if (pdbPaths) {
            pdbPaths.forEach(pdbFile => {
                if (pdbFile) {
                    let pdbPath = utils.checkAndFixFilePath(pdbFile, continueOnError);
                    // The path can be null if continueIfSymbolsNotFound is true and the file does not exist.
                    if (pdbPath) {
                        symbolsPaths.push(pdbPath);
                    }
                }
            })
        }
    } else {
        // For all other application types user can specifay a symbols path pattern
        // that selects only one file or one folder.
        let symbolsFile = utils.resolveSinglePath(pattern, continueOnError, packParentFolder);

        // Resolved paths can be null if continueIfSymbolsNotFound is true and the file/folder does not exist.
        if (symbolsFile) {
            let filePath = utils.checkAndFixFilePath(symbolsFile, continueOnError);
            // The path can be null if continueIfSymbolsNotFound is true and the file/folder does not exist.
            if (filePath) {
                symbolsPaths.push(filePath);
            }
        }
    }

    return symbolsPaths;
}

/**
 * Tries to get release by id.
 * @param apiServer server url.
 * @param apiVersion app center api version.
 * @param appSlug name of the app (owner/app).
 * @param releaseId predicted release id.
 * @param token API token.
 * @param userAgent header value for User-Agent.
 * @returns {Promise<any>} - the promise is resolved if the release with the provided id already exists.
*/
async function getReleaseId(apiServer: string, apiVersion: string, appSlug: string, releaseId: string, token: string, userAgent: string): Promise<any> {
    tl.debug("-- Getting release.");
    const getReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/uploads/releases/${releaseId}`;
    tl.debug(`---- url: ${getReleaseUrl}`);
    const headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    const { body } = await getClient({ headers }).get(getReleaseUrl).then(handleResponse);
    return body;
}

/**
 * Tries to get release by id until it exists.
 * @param apiServer server url.
 * @param apiVersion app center api version.
 * @param appSlug name of the app (owner/app).
 * @param uploadId predicted release id.
 * @param token API token.
 * @param userAgent header value for User-Agent.
 * @returns {Promise<any>} - the promise is resolved once the release with the provided id exists.
*/
function loadReleaseIdUntilSuccess(apiServer: string, apiVersion: string, appSlug: string, uploadId: string, token: string, userAgent: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const timerId = setInterval(async () => {
            let response;
            try {
                response = await getReleaseId(apiServer, apiVersion, appSlug, uploadId, token, userAgent);
            } catch (error) {
                clearInterval(timerId);
                reject(new Error(`Loading release id failed with: ${error}`));
            }
            if (response && response.upload_status === "readyToBePublished" && response.release_distinct_id) {
                const releaseId = response.release_distinct_id;
                tl.debug(`---- Received release id is ${releaseId}`);
                clearInterval(timerId);
                resolve(releaseId);
            } else if (!response || response.upload_status === "error") {
                clearInterval(timerId);
                reject(new Error(`Loading release id failed: ${response ? response.error_details : ''}`));
            }
        }, 2000);
    });
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get build inputs
        let apiEndpointData = getEndpointDetails('serverEndpoint');
        let apiToken: string = apiEndpointData.authToken;
        let apiServer: string = apiEndpointData.apiServer;
        let apiVersion: string = apiEndpointData.apiVersion;

        let userAgent = tl.getVariable('MSDEPLOY_HTTP_USER_AGENT');
        if (!userAgent) {
            userAgent = 'VSTS';
        }
        userAgent = userAgent + ' (Task:VSMobileCenterUpload)';

        var effectiveApiServer = process.env['SONOMA_API_SERVER'] || apiServer;
        var effectiveApiVersion = process.env['SONOMA_API_VERSION'] || apiVersion;

        tl.debug(`Effective API Url: ${effectiveApiServer}/${effectiveApiVersion}`);

        let appSlug: string = tl.getInput('appSlug', true);
        let appFilePattern: string = tl.getInput('app', true);

        /* The task has support for different symbol types but App Center server only support Apple currently, add back these types in the task.json when support is available in App Center.
        "AndroidJava": "Android (Java)",
        "AndroidNative": "Android (native C/C++)",
        "Windows": "Windows 8.1",
        "UWP": "Universal Windows Platform (UWP)"
        */
        let symbolsType: string = tl.getInput('symbolsType', false);
        let symbolVariableName = null;
        switch (symbolsType) {
            case "Apple":
                symbolVariableName = "dsymPath";
                break;
            case "AndroidJava":
                symbolVariableName = "mappingTxtPath";
                break;
            case "UWP":
                symbolVariableName = "pdbPath";
                break;
            default:
                symbolVariableName = "symbolsPath";
        }
        let symbolsPathPattern: string = tl.getInput(symbolVariableName, false);
        let packParentFolder: boolean = tl.getBoolInput('packParentFolder', false);

        let releaseNotesSelection = tl.getInput('releaseNotesSelection', true);
        let releaseNotes: string = null;
        if (releaseNotesSelection === 'file') {
            let releaseNotesFile = tl.getPathInput('releaseNotesFile', true, true);
            releaseNotes = fs.readFileSync(releaseNotesFile).toString('utf8');
        } else {
            releaseNotes = tl.getInput('releaseNotesInput', true);
        }

        let isMandatory: boolean = tl.getBoolInput('isMandatory', false);

        let destinations = tl.getInput('destinationIds', false) || '00000000-0000-0000-0000-000000000000';
        tl.debug(`Effective destinationIds: ${destinations}`);
        let destinationIds = destinations.split(/[, ;]+/).filter(id => id);

        // Validate inputs
        if (!apiToken) {
            throw new Error(tl.loc("NoApiTokenFound"));
        }
        if (!destinationIds.length) {
            throw new Error(tl.loc("InvalidDestinationInput"));
        }

        let app = utils.resolveSinglePath(appFilePattern);
        tl.checkPath(app, "Binary file");

        let continueIfSymbolsNotFoundVariable = tl.getVariable('VSMobileCenterUpload.ContinueIfSymbolsNotFound');
        let continueIfSymbolsNotFound = false;
        if (continueIfSymbolsNotFoundVariable && continueIfSymbolsNotFoundVariable.toLowerCase() === 'true') {
            continueIfSymbolsNotFound = true;
        }

        // Expand symbols path pattern to a list of paths
        let symbolsPaths = expandSymbolsPaths(symbolsType, symbolsPathPattern, continueIfSymbolsNotFound, packParentFolder);

        // Prepare symbols
        let symbolsFile = await prepareSymbols(symbolsPaths);

        // Begin release upload
        let uploadInfo: UploadInfo = await beginReleaseUpload(effectiveApiServer, effectiveApiVersion, appSlug, apiToken, userAgent);
        const uploadId = uploadInfo.id;
        let releaseId: string;
        try {
            // Perform the upload
            await uploadRelease(uploadInfo, app);

            // Commit the upload
            await patchRelease(effectiveApiServer, effectiveApiVersion, appSlug, uploadId, apiToken, userAgent);
            releaseId = await loadReleaseIdUntilSuccess(effectiveApiServer, effectiveApiVersion, appSlug, uploadId, apiToken, userAgent);
        } catch (error) {
            try {
                return abortReleaseUpload(effectiveApiServer, effectiveApiVersion, appSlug, uploadId, apiToken, userAgent);
            } catch (abortError) {
                tl.debug("---- Failed to abort release upload");
            }
            throw error;
        }
        let publishUrl = `${effectiveApiServer}/${apiVersion}/apps/${appSlug}/releases/${releaseId}`;

        // Publish
        await publishRelease(publishUrl, isMandatory, releaseNotes, destinationIds, apiToken, userAgent);

        if (symbolsFile) {
            // Begin preparing upload symbols
            let symbolsUploadInfo = await beginSymbolUpload(effectiveApiServer, effectiveApiVersion, appSlug, symbolsType, apiToken, userAgent);

            // upload symbols
            await uploadSymbols(symbolsUploadInfo.upload_url, symbolsFile);

            // Commit the symbols upload
            await commitSymbols(effectiveApiServer, effectiveApiVersion, appSlug, symbolsUploadInfo.symbol_upload_id, apiToken, userAgent);
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Succeeded"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, `${err}`);
    }
}

run();
