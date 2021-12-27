import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import request = require('request');
import Q = require('q');
import fs = require('fs');
import os = require('os');

import { AzureBlobUploadHelper } from './azure-blob-upload-helper';
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
import utils = require('./utils');
import { inspect } from 'util';

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

type DestinationType = "groups" | "store";
const DestinationType = {
    Groups: "groups" as DestinationType,
    Store: "store" as DestinationType
}

const DestinationTypeParameter = {
    [DestinationType.Groups]: "groups",
    [DestinationType.Store]: "stores"
}

let mcFusUploader: ACFusUploader = null;

interface Release {
    version: string;
    short_version: string;
}

type ApiSymbolType = "Apple" | "AndroidProguard" | "Breakpad" | "UWP";
type TaskSymbolType = "Apple" | "Android" | "UWP";
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

function responseHandler(defer, err, res, body, handler: () => void) {
    if (body) {
        tl.debug(`---- ${JSON.stringify(body)}`);
    }

    if (err) {
        tl.debug(`---- Failed with error: ${err}`);
        defer.reject(err);
        return;
    }

    if (!res) {
        defer.reject(tl.loc("NoResponseFromServer"));
        return;
    }

    tl.debug(`---- http call status code: ${res.statusCode}`);
    if (res.statusCode < 200 || res.statusCode >= 300) {
        let message = JSON.stringify(body);
        if (!message) {
            message = `http response code: ${res.statusCode}`;
        } else {
            message = message.concat(os.EOL + `http response code: ${res.statusCode}`);
        }
        defer.reject(message);
        return;
    }

    handler();
}

function beginReleaseUpload(apiServer: string, apiVersion: string, appSlug: string, token: string, userAgent: string, buildVersion: string): Q.Promise<UploadInfo> {
    tl.debug("-- Prepare for uploading release.");
    let defer = Q.defer<UploadInfo>();
    let beginUploadUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/uploads/releases`;
    tl.debug(`---- url: ${beginUploadUrl}`);

    let headers = {
        "Content-Type": "application/json",
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    const requestOptions: request.UrlOptions & request.CoreOptions = { url: beginUploadUrl, headers };
    if (buildVersion) {
        requestOptions.body = JSON.stringify({
            "build_version": buildVersion
        });
    }

    request.post(requestOptions, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            let response = JSON.parse(body);
            if (!response.package_asset_id || (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300))) {
                defer.reject(`failed to create release upload. ${response.message}`)
            }
            defer.resolve(response);
        });
    });

    return defer.promise;
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
function loadReleaseIdUntilSuccess(apiServer: string, apiVersion: string, appSlug: string, uploadId: string, token: string, userAgent: string): Q.Promise<any> {
    let defer = Q.defer<void>();
    const timerId = setInterval(async () => {
        let response;
        try {
            response = await getReleaseId(apiServer, apiVersion, appSlug, uploadId, token, userAgent);
        } catch (error) {
            clearInterval(timerId);
            defer.reject(new Error(`Loading release id failed with: ${error}`));
        }
        if (response && response.upload_status === "readyToBePublished" && response.release_distinct_id) {
            const releaseId = response.release_distinct_id;
            tl.debug(`---- Received release id is ${releaseId}`);
            clearInterval(timerId);
            defer.resolve(releaseId);
        } else if (!response || response.upload_status === "error") {
            clearInterval(timerId);
            defer.reject(new Error(`Loading release id failed: ${response ? response.error_details : ''}`));
        }
    }, 2000);
    return defer.promise;
}

/**
 * Uploads a the binary to App Center using appcenter-file-upload-client.
 * @param releaseUploadParams release params from "beginReleaseUpload" call.
 * @param file path to the file to be uploaded.
 * @returns {Promise<any>} - the promise is resolved once the upload has been reported as completed.
*/
function uploadRelease(releaseUploadParams: UploadInfo, file: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const assetId = releaseUploadParams.package_asset_id;
        const urlEncodedToken = releaseUploadParams.url_encoded_token;
        const uploadDomain = releaseUploadParams.upload_domain;
        tl.debug("-- Uploading release...");
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
        const fullFile = path.resolve(file);
        const appFile = new ACFile(fullFile);
        mcFusUploader.start(appFile);
    });
}

function patchRelease(apiServer: string, apiVersion: string, appSlug: string, upload_id: string, token: string, userAgent: string): Q.Promise<void> {
    tl.debug("-- Finishing uploading release...");
    let defer = Q.defer<void>();
    let patchReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/uploads/releases/${upload_id}`;
    tl.debug(`---- url: ${patchReleaseUrl}`);
    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    let uploadFinishedBody = { "upload_status": "uploadFinished" };

    request.patch({ url: patchReleaseUrl, headers: headers, json: uploadFinishedBody }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            const { upload_status, message } = body;
            if (upload_status !== "uploadFinished") {
                defer.reject(`Failed to patch release upload: ${message}`);
            }
            defer.resolve();
        });
    })

    return defer.promise;
}

function publishRelease(apiServer: string, apiVersion: string, appSlug: string, releaseId: string, destinationType: DestinationType, isMandatory: boolean, isSilent: boolean, destinationId: string, token: string, userAgent: string) {
    tl.debug("-- Mark package available.");
    let defer = Q.defer<void>();
    let publishReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/releases/${releaseId}/${DestinationTypeParameter[destinationType]}`;
    tl.debug(`---- url: ${publishReleaseUrl}`);

    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    let publishBody = {
        "id": destinationId
    };

    if (destinationType === DestinationType.Groups) {
        publishBody["mandatory_update"] = isMandatory;
        if (isSilent) {
            publishBody["notify_testers"] = false;
        }
    }

    // Builds started by App Center has the commit message set when distribution is enabled
    const commitMessage = process.env['LASTCOMMITMESSAGE'];
    // Updating the internal_request_source to distinguish the AppCenter triggered build and custom build
    if (!!commitMessage) {
        headers["internal-request-source"] = "VSTS-APPCENTER";
    }

    request.post({ url: publishReleaseUrl, headers: headers, json: publishBody }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            defer.resolve();
        });
    })

    return defer.promise;
}

function updateRelease(apiServer: string, apiVersion: string, appSlug: string, releaseId: string, releaseNotes: string, token: string, userAgent: string) {
    tl.debug("-- Updating release.");
    let defer = Q.defer<void>();
    let publishReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/releases/${releaseId}`;
    tl.debug(`---- url: ${publishReleaseUrl}`);

    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    let publishBody = {
        "release_notes": releaseNotes
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

    request.put({ url: publishReleaseUrl, headers: headers, json: publishBody }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            defer.resolve();
        });
    })

    return defer.promise;
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
function getReleaseId(apiServer: string, apiVersion: string, appSlug: string, releaseId: string, token: string, userAgent: string): Q.Promise<any> {
    tl.debug("-- Getting release id.");
    let defer = Q.defer<Release>();
    let getReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/uploads/releases/${releaseId}`;
    tl.debug(`---- url: ${getReleaseUrl}`);

    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    request.get({ url: getReleaseUrl, headers: headers }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            if ((res["status"] < 200 || res["status"] >= 300)) {
                defer.reject(new Error(`HTTP status ${res["status"]}`));
            }
            defer.resolve(JSON.parse(body));
        });
    })

    return defer.promise;
}

function getRelease(apiServer: string, apiVersion: string, appSlug: string, releaseId: string, token: string, userAgent: string): Q.Promise<Release> {
    tl.debug("-- Getting release.");
    let defer = Q.defer<Release>();
    let getReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/releases/${releaseId}`;
    tl.debug(`---- url: ${getReleaseUrl}`);

    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    request.get({ url: getReleaseUrl, headers: headers }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            defer.resolve(JSON.parse(body));
        });
    })

    return defer.promise;
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
function prepareSymbols(symbolsPaths: string[], forceArchive: boolean = false): Q.Promise<string> {
    tl.debug("-- Prepare symbols");
    let defer = Q.defer<string>();

    if (!forceArchive && symbolsPaths.length === 1 && fs.statSync(symbolsPaths[0]).isFile()) {
        tl.debug(`.. a single symbols file: ${symbolsPaths[0]}`)

        // single file - Android source mapping txt file
        defer.resolve(symbolsPaths[0]);
    } else if (symbolsPaths.length > 0) {
        tl.debug(`.. archiving: ${symbolsPaths}`);

        let symbolsRoot = utils.findCommonParent(symbolsPaths);
        let zipPath = utils.getArchivePath(symbolsRoot);
        let zipStream = utils.createZipStream(symbolsPaths, symbolsRoot);

        utils.createZipFile(zipStream, zipPath).
            then(() => {
                tl.debug(`---- symbols archive file: ${zipPath}`)
                defer.resolve(zipPath);
            });
    } else {
        defer.resolve(null);
    }


    return defer.promise;
}

function beginSymbolUpload(apiServer: string, apiVersion: string, appSlug: string, symbol_type: ApiSymbolType, token: string, userAgent: string, version?: string, build?: string): Q.Promise<SymbolsUploadInfo> {
    tl.debug("-- Begin symbols upload")
    let defer = Q.defer<SymbolsUploadInfo>();

    let beginSymbolUploadUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/symbol_uploads`;
    tl.debug(`---- url: ${beginSymbolUploadUrl}`);

    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    const symbolsUploadBody = { "symbol_type": symbol_type };

    if (symbol_type === "AndroidProguard") {
        symbolsUploadBody["file_name"] = "mapping.txt";
        symbolsUploadBody["version"] = version;
        symbolsUploadBody["build"] = build;
    }

    request.post({ url: beginSymbolUploadUrl, headers: headers, json: symbolsUploadBody }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            let symbolsUploadInfo: SymbolsUploadInfo = {
                symbol_upload_id: body['symbol_upload_id'],
                upload_url: body['upload_url'],
                expiration_date: body['expiration_date']
            }

            defer.resolve(symbolsUploadInfo);
        });
    })

    return defer.promise;
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

function commitSymbols(apiServer: string, apiVersion: string, appSlug: string, symbol_upload_id: string, token: string, userAgent: string): Q.Promise<void> {
    tl.debug("-- Finishing uploading symbols...");
    let defer = Q.defer<void>();
    let commitSymbolsUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/symbol_uploads/${symbol_upload_id}`;
    tl.debug(`---- url: ${commitSymbolsUrl}`);
    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    let commitBody = { "status": "committed" };

    request.patch({ url: commitSymbolsUrl, headers: headers, json: commitBody }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            defer.resolve();
        });
    })

    return defer.promise;
}

function expandSymbolsPaths(symbolsType: string, pattern: string, continueOnError: boolean, packParentFolder: boolean): string[] {
    tl.debug("-- Expanding symbols path pattern to a list of paths");

    let symbolsPaths: string[] = [];

    if (symbolsType === "Apple" || symbolsType === "Breakpad") {
        // User can specifay a symbols path pattern that selects
        // multiple symbols folder paths.
        const symbolPaths = utils.resolvePaths(pattern, continueOnError, packParentFolder);

        // Resolved paths can be null if continueIfSymbolsNotFound is true and the file/folder does not exist.
        if (symbolPaths) {
            symbolPaths.forEach(symbolFolder => {
                if (symbolFolder) {
                    const folderPath = utils.checkAndFixFilePath(symbolFolder, continueOnError);
                    // The path can be null if continueIfSymbolsNotFound is true and the folder does not exist.
                    if (folderPath) {
                        symbolsPaths.push(folderPath);
                    }
                }
            })
        }
    } else {
        // For all other application types user can specify a symbols path pattern
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
        "AndroidNative": "Android (native C/C++)",
        "Windows": "Windows 8.1",
        "UWP": "Universal Windows Platform (UWP)"
        */
        const symbolType: TaskSymbolType = tl.getInput('symbolsType', false) as TaskSymbolType;
        const symbolsLookup: { symbolType: ApiSymbolType, fieldName: string, forceArchive?: boolean }[] = [];
        switch (symbolType) {
            case "Apple":
                symbolsLookup.push({ symbolType, fieldName: "dsymPath" });
                break;
            case "Android":
                symbolsLookup.push({ symbolType: "AndroidProguard", fieldName: "mappingTxtPath" });
                symbolsLookup.push({ symbolType: "Breakpad", fieldName: "nativeLibrariesPath", forceArchive: true });
                break;
            case "UWP":
                symbolsLookup.push({ symbolType, fieldName: "appxsymPath" });
                break;
            default:
                symbolsLookup.push({ symbolType, fieldName: "symbolsPath" });
        }

        let buildVersion: string = tl.getInput('buildVersion', false);
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

        const destinationType = tl.getInput('destinationType', false) as DestinationType || DestinationType.Groups;
        const destinationsInputName = destinationType === DestinationType.Groups ? 'destinationGroupIds' : 'destinationStoreId';
        const destinationIsMandatory = destinationType === DestinationType.Store;

        let destinations = tl.getInput(destinationsInputName, destinationIsMandatory) || "00000000-0000-0000-0000-000000000000";
        tl.debug(`Effective destinationIds: ${destinations}`);
        let destinationIds = destinations.split(/[, ;]+/).map(id => id.trim()).filter(id => id);

        // Validate inputs
        if (!apiToken) {
            throw new Error(tl.loc("NoApiTokenFound"));
        }
        if (!destinationIds.length) {
            throw new Error(tl.loc("InvalidDestinationInput"));
        }
        if (destinationType === DestinationType.Store && destinationIds.length > 1) {
            throw new Error(tl.loc("CanNotDistributeToMultipleStores"));
        }

        const isSilent: boolean = destinationType === DestinationType.Groups && (tl.getBoolInput('isSilent', false) || false);

        let app = utils.resolveSinglePath(appFilePattern);
        tl.checkPath(app, "Binary file");

        let continueIfSymbolsNotFoundVariable = tl.getVariable('VSMobileCenterUpload.ContinueIfSymbolsNotFound');
        let continueIfSymbolsNotFound = false;
        if (continueIfSymbolsNotFoundVariable && continueIfSymbolsNotFoundVariable.toLowerCase() === 'true') {
            continueIfSymbolsNotFound = true;
        }

        // Begin release upload
        let uploadInfo: UploadInfo = await beginReleaseUpload(effectiveApiServer, effectiveApiVersion, appSlug, apiToken, userAgent, buildVersion);
        const uploadId = uploadInfo.id;
        let releaseId: string;

        await uploadRelease(uploadInfo, app);
        await patchRelease(effectiveApiServer, effectiveApiVersion, appSlug, uploadId, apiToken, userAgent);
        releaseId = await loadReleaseIdUntilSuccess(effectiveApiServer, effectiveApiVersion, appSlug, uploadId, apiToken, userAgent);

        await updateRelease(effectiveApiServer, effectiveApiVersion, appSlug, releaseId, releaseNotes, apiToken, userAgent);

        await Q.all(destinationIds.map(destinationId => {
            return publishRelease(effectiveApiServer, effectiveApiVersion, appSlug, releaseId, destinationType, isMandatory, isSilent, destinationId, apiToken, userAgent);
        }));

        for (const { fieldName, symbolType, forceArchive } of symbolsLookup) {
            const symbolsPathPattern: string = tl.getInput(fieldName, false);

            // Expand symbols path pattern to a list of paths
            const symbolsPaths = expandSymbolsPaths(symbolType, symbolsPathPattern, continueIfSymbolsNotFound, packParentFolder);

            // Prepare symbols
            const symbolsFile = await prepareSymbols(symbolsPaths, forceArchive);

            if (symbolsFile) {
                // Begin preparing upload symbols
                let version: string;
                let build: string;
                if (symbolType === "AndroidProguard") {
                    const release = await getRelease(effectiveApiServer, effectiveApiVersion, appSlug, releaseId, apiToken, userAgent);
                    version = release.short_version;
                    build = release.version;
                }
                const symbolsUploadInfo = await beginSymbolUpload(effectiveApiServer, effectiveApiVersion, appSlug, symbolType, apiToken, userAgent, version, build);

                // upload symbols
                await uploadSymbols(symbolsUploadInfo.upload_url, symbolsFile);

                // Commit the symbols upload
                await commitSymbols(effectiveApiServer, effectiveApiVersion, appSlug, symbolsUploadInfo.symbol_upload_id, apiToken, userAgent);
            }
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Succeeded"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, `${err}`);
    }
}

run();
