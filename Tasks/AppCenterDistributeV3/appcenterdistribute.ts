import path = require('path');
import tl = require('vsts-task-lib/task');
import request = require('request');
import Q = require('q');
import fs = require('fs');
import os = require('os');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

import utils = require('./utils');

class UploadInfo {
    upload_id: string;
    upload_url: string;
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

function beginReleaseUpload(apiServer: string, apiVersion: string, appSlug: string, token: string, userAgent: string): Q.Promise<UploadInfo> {
    tl.debug("-- Prepare for uploading release.");
    let defer = Q.defer<UploadInfo>();
    let beginUploadUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/release_uploads`;
    tl.debug(`---- url: ${beginUploadUrl}`);

    let headers = {
        "Content-Type": "application/json",
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    request.post({ url: beginUploadUrl, headers: headers }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            let response = JSON.parse(body);
            let uploadInfo: UploadInfo = {
                upload_id: response['upload_id'],
                upload_url: response['upload_url']
            }

            defer.resolve(uploadInfo);
        });
    });

    return defer.promise;
}

function uploadRelease(uploadUrl: string, file: string, userAgent: string): Q.Promise<void> {
    tl.debug("-- Uploading release...");
    let defer = Q.defer<void>();
    tl.debug(`---- url: ${uploadUrl}`);
    let headers = {
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };
    let req = request.post({ url: uploadUrl, headers: headers }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            tl.debug('-- File uploaded.');
            defer.resolve();
        });
    });

    let form = req.form();
    form.append('ipa', fs.createReadStream(file));

    return defer.promise;
}

function commitRelease(apiServer: string, apiVersion: string, appSlug: string, upload_id: string, token: string, userAgent: string): Q.Promise<string> {
    tl.debug("-- Finishing uploading release...");
    let defer = Q.defer<string>();
    let commitReleaseUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/release_uploads/${upload_id}`;
    tl.debug(`---- url: ${commitReleaseUrl}`);
    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    let commitBody = { "status": "committed" };

    request.patch({ url: commitReleaseUrl, headers: headers, json: commitBody }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            if (body && body['release_url']) {
                defer.resolve(body['release_id']);
            } else {
                defer.reject(tl.loc("FailedToUploadFile"));
            }
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
function prepareSymbols(symbolsPaths: string[]): Q.Promise<string> {
    tl.debug("-- Prepare symbols");
    let defer = Q.defer<string>();

    if (symbolsPaths.length === 1 && fs.statSync(symbolsPaths[0]).isFile()) {
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
                tl.debug(`---- symbols arechive file: ${zipPath}`)
                defer.resolve(zipPath);
            });
    } else {
        defer.resolve(null);
    }


    return defer.promise;
}

function beginSymbolUpload(apiServer: string, apiVersion: string, appSlug: string, symbol_type: string, token: string, userAgent: string): Q.Promise<SymbolsUploadInfo> {
    tl.debug("-- Begin symbols upload")
    let defer = Q.defer<SymbolsUploadInfo>();

    let beginSymbolUploadUrl: string = `${apiServer}/${apiVersion}/apps/${appSlug}/symbol_uploads`;
    tl.debug(`---- url: ${beginSymbolUploadUrl}`);

    let headers = {
        "X-API-Token": token,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    let symbolsUploadBody = { "symbol_type": symbol_type };

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

function uploadSymbols(uploadUrl: string, file: string, userAgent: string): Q.Promise<void> {
    tl.debug("-- Uploading symbols...");
    let defer = Q.defer<void>();
    tl.debug(`---- url: ${uploadUrl}`);

    let stat = fs.statSync(file);
    let headers = {
        "x-ms-blob-type": "BlockBlob",
        "Content-Length": stat.size,
        "User-Agent": userAgent,
        "internal-request-source": "VSTS"
    };

    fs.createReadStream(file).pipe(request.put({ url: uploadUrl, headers: headers }, (err, res, body) => {
        responseHandler(defer, err, res, body, () => {
            tl.debug('-- Symbol uploaded.');
            defer.resolve();
        });
    }));

    return defer.promise;
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

        // Expand symbols path pattern to a list of paths
        let symbolsPaths = expandSymbolsPaths(symbolsType, symbolsPathPattern, continueIfSymbolsNotFound, packParentFolder);

        // Prepare symbols
        let symbolsFile = await prepareSymbols(symbolsPaths);

        // Begin release upload
        let uploadInfo: UploadInfo = await beginReleaseUpload(effectiveApiServer, effectiveApiVersion, appSlug, apiToken, userAgent);

        // Perform the upload
        await uploadRelease(uploadInfo.upload_url, app, userAgent);

        // Commit the upload
        let releaseId = await commitRelease(effectiveApiServer, effectiveApiVersion, appSlug, uploadInfo.upload_id, apiToken, userAgent);

        await updateRelease(effectiveApiServer, effectiveApiVersion, appSlug, releaseId, releaseNotes, apiToken, userAgent);
        
        await Q.all(destinationIds.map(destinationId => {
            return publishRelease(effectiveApiServer, effectiveApiVersion, appSlug, releaseId, destinationType, isMandatory, isSilent, destinationId, apiToken, userAgent);
        }));

        if (symbolsFile) {
            // Begin preparing upload symbols
            let symbolsUploadInfo = await beginSymbolUpload(effectiveApiServer, effectiveApiVersion, appSlug, symbolsType, apiToken, userAgent);

            // upload symbols
            await uploadSymbols(symbolsUploadInfo.upload_url, symbolsFile, userAgent);

            // Commit the symbols upload
            await commitSymbols(effectiveApiServer, effectiveApiVersion, appSlug, symbolsUploadInfo.symbol_upload_id, apiToken, userAgent);
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc("Succeeded"));
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, `${err}`);
    }
}

run();
