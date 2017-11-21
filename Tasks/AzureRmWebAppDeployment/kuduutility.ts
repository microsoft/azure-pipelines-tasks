import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
import * as rm from "typed-rest-client/RestClient";
import * as hm from "typed-rest-client/HttpClient";
import httpInterfaces = require("typed-rest-client/Interfaces");

let proxyUrl: string = tl.getVariable("agent.proxyurl"); 
var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? { 
    proxy: { 
        proxyUrl: proxyUrl, 
        proxyUsername: tl.getVariable("agent.proxyusername"), 
        proxyPassword: tl.getVariable("agent.proxypassword"), 
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null 
    } 
} : {}; 

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";
let hc = new hm.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);
let rc = new rm.RestClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, null, requestOptions);

var fileEncoding = require('webdeployment-common/fileencoding.js');
var azureUtility = require('azurerest-common/utility.js');

/**
 * Finds out virtual path and corresponding physical path mapping.
 * 
 * @param   virtualApplication Virtual Application details
 * @param   virtualApplicationMappings  
 */
export function getVirtualAndPhysicalPaths(virtualApplication: string, virtualApplicationMappings) {
    // construct URL depending on virtualApplication or root of webapplication 
    var physicalPath = null;
    var virtualPath = "/" + virtualApplication;
    
    for( var index in virtualApplicationMappings ) {
        var mapping = virtualApplicationMappings[index];
        if( mapping.virtualPath.toLowerCase() == virtualPath.toLowerCase()){
            physicalPath = mapping.physicalPath;
            break;
        }
    }

    return [virtualPath, physicalPath];
}

export async function appOfflineKuduService(publishingProfile, physicalPath: string, enableFeature: boolean) {
    if(enableFeature) {
        tl.debug('Trying to enable app offline mode.');
        var appOfflineFilePath = path.join(tl.getVariable('system.DefaultWorkingDirectory'), 'app_offline_temp.htm');
        tl.writeFile(appOfflineFilePath, '<h1>App Service is offline.</h1>');
        await uploadFiletoKudu(publishingProfile, '/site/wwwroot', 'app_offline.htm', appOfflineFilePath);
        tl.debug('App Offline mode enabled.');
    }
    else {
        tl.debug('Trying to disable app offline mode.');
        await deleteFileFromKudu(publishingProfile, 'site/wwwroot', 'app_offline.htm', false);
        tl.debug('App Offline mode disabled.');
    }
}

/**
 *  Deploys a zip based webapp package.
 * 
 *  @param  webAppPackage                  Zip file or folder for deployment
 *  @param  publishingProfile              publish profile provides destination details for deployment
 *  @param  virtualApplication             (Optional) Virtual application name
 *  @param  virtualApplicationMappings     Mapping to get physical path for deployment 
 */
export async function deployWebAppPackage(webAppPackage: string, publishingProfile, virtualPath: string, physicalPath: string, takeAppOfflineFlag: boolean) {

    var deferred = Q.defer<any>();
    var kuduDeploymentURL = "https://" + publishingProfile.publishUrl + "/api/zip/" + physicalPath;
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'content-type': 'multipart/form-data',
        'If-Match': '*'
    };
    if(takeAppOfflineFlag) {
        await appOfflineKuduService(publishingProfile, physicalPath, true);
    }
    console.log(tl.loc("Deployingwebapplicationatvirtualpathandphysicalpath", webAppPackage, virtualPath, physicalPath));
    var webAppReadStream = fs.createReadStream(webAppPackage);

    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.uploadStream('PUT', kuduDeploymentURL, webAppReadStream, options);
    promise.then(async (response) => {
        if(response.statusCode === 200) {
            console.log(tl.loc("Successfullydeployedpackageusingkuduserviceat", webAppPackage, publishingProfile.publishUrl));
            if(takeAppOfflineFlag) {
                tl.debug('Trying to disable app offline mode.');
                try {
                    await appOfflineKuduService(publishingProfile, physicalPath, false);
                    tl.debug('App Offline mode disabled.');
                }
                catch(error) {
                    deferred.reject(error);
                } 
            }
             deferred.resolve(tl.loc("Successfullydeployedpackageusingkuduserviceat", webAppPackage, publishingProfile.publishUrl));
        }
        else {
            tl.debug("Action: deployWebAppPackage, Response: " + JSON.stringify(response));
            deferred.reject(tl.loc('Unabletodeploywebappresponsecode', response.statusCode));
        }
    },
    (error) => {
        deferred.reject(tl.loc("Failedtodeploywebapppackageusingkuduservice", error));
    });

    return deferred.promise;
}

export async function ensurePhysicalPathExists(publishingProfile, physicalPath: string) {
    var defer = Q.defer<string>();
    physicalPath = physicalPath.replace(/[\\]/g, "/");
    var kuduPhysicalpathUrl = "https://" + publishingProfile.publishUrl + "/api/vfs/" + physicalPath + "/";
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': "*"
    };
    tl.debug("Requested URL for kudu physical path : " + kuduPhysicalpathUrl);
    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.get(kuduPhysicalpathUrl, options);
    promise.then(async (response) => {
        if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug("Physical path '" + physicalPath + "' already exists ");
            defer.resolve(tl.loc('Physicalpathalreadyexists'));
        }
        else if(response.statusCode === 404) {
            tl.debug("Physical path doesn't exists. Creating physical path.")
            defer.resolve(await createPhysicalPath(publishingProfile, physicalPath));
        } else {
            tl.debug("Action: ensurePhysicalPathExists, Response: " + JSON.stringify(response));
            defer.reject(tl.loc('FailedtocheckphysicalPath', response.statusCode));
        }
    },
    (error) => {
        defer.reject(error);
    });

    return defer.promise;
}

export async function runPostDeploymentScript(publishingProfile, physicalPath, scriptType, inlineScript, scriptPath, appOfflineFlag) {
    var scriptFile = getPostDeploymentScript(scriptType, inlineScript, scriptPath);
    var uniqueID = azureUtility.generateDeploymentId();
    tl.debug('Deployment ID : ' + uniqueID);
    var deleteLogFiles = false;

    if(appOfflineFlag) {
        await appOfflineKuduService(publishingProfile, physicalPath, true);
    }
    try {
        var mainCmdFilePath = path.join(__dirname, 'postDeploymentScript', 'mainCmdFile.cmd');
        await uploadFiletoKudu(publishingProfile, physicalPath, 'mainCmdFile_' + uniqueID + '.cmd', mainCmdFilePath);
        await uploadFiletoKudu(publishingProfile, physicalPath, 'kuduPostDeploymentScript_' + uniqueID + '.cmd', scriptFile.filePath);
        console.log(tl.loc('ExecuteScriptOnKudu', publishingProfile.publishUrl));
        await runCommandOnKudu(publishingProfile, physicalPath, 'mainCmdFile_' + uniqueID + '.cmd ' + uniqueID, 30, 'script_result_' +  uniqueID + '.txt');
        console.log(tl.loc('ScriptExecutionOnKuduSuccess'));
        deleteLogFiles = true;
        await getPostDeploymentScriptLogs(publishingProfile, physicalPath, uniqueID);
    }
    catch(Exception) {
        throw Error(Exception);
    }
    finally {
        if(scriptFile.isCreated) {
            tl.rmRF(scriptFile.filePath, true);
        }
        try {
            await uploadFiletoKudu(publishingProfile, physicalPath, 'delete_log_file_' + uniqueID + '.cmd', path.join(__dirname, 'postDeploymentScript', 'deleteLogFile.cmd'));
            var commandResult = await runCommandOnKudu(publishingProfile, physicalPath, 'delete_log_file_' + uniqueID + '.cmd ' + uniqueID, 0, null);
            tl.debug(JSON.stringify(commandResult));
        }
        catch(error) {
            tl.debug('Unable to delete log files : ' + error);
        }
        if(appOfflineFlag) {
            await appOfflineKuduService(publishingProfile, physicalPath, false);
        }
    }
}

function getPostDeploymentScript(scriptType, inlineScript, scriptPath) {
    if(scriptType === 'Inline Script') {
        tl.debug('creating kuduPostDeploymentScript_local file');
        var scriptFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'),'kuduPostDeploymentScript_local.cmd');
        tl.writeFile(scriptFilePath, inlineScript);
        tl.debug('Created temporary script file : ' + scriptFilePath);
        return {
            filePath: scriptFilePath,
            isCreated: true
        };
    }
    if(!tl.exist(scriptPath)) {
        throw Error(tl.loc('ScriptFileNotFound', scriptPath));
    }
    var scriptExtension = path.extname(scriptPath);
    if(scriptExtension != '.bat' && scriptExtension != '.cmd') {
        throw Error(tl.loc('InvalidScriptFile', scriptPath));
    }
    tl.debug('postDeployment script path to execute : ' + scriptPath);
    return {
        filePath: scriptPath,
        isCreated: false
    }
}

async function createPhysicalPath(publishingProfile, physicalPath: string) {
    var defer = Q.defer<string>();
    var kuduPhysicalpathUrl = "https://" + publishingProfile.publishUrl + "/api/vfs/" + physicalPath + "/";
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': "*"
    };
    tl.debug("Requested URL for kudu physical path : " + kuduPhysicalpathUrl);
    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.replace(kuduPhysicalpathUrl, null, options);
    promise.then((response) => {
        if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug("Kudu physical path : '" + physicalPath + "' created successfully ");
            defer.resolve(tl.loc('KuduPhysicalpathCreatedSuccessfully', physicalPath));
        }
        else {
            tl.debug("Action: createPhysicalPath, Response: " + JSON.stringify(response));
            defer.reject(tl.loc('FailedtocreateKuduPhysicalPath', response.statusCode));
        }
    },
    (error) => {
        defer.reject(error);
    });

    return defer.promise;
}

async function uploadFiletoKudu(publishingProfile, physicalPath: string, fileName: string, filePath: string) {
    var defer = Q.defer<string>();
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*'
    };
    var readStream = fs.createReadStream(filePath);
    var kuduDeploymentURL = "https://" + publishingProfile.publishUrl + "/api/vfs/" + physicalPath + '/' + fileName;

    tl.debug('Uploading file: ' + fileName + ' using publishUrl: ' + kuduDeploymentURL);
    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.uploadStream('PUT', kuduDeploymentURL, readStream, options);
    promise.then((response) => {
        if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug('Uploaded file: ' + fileName + ' at path: ' + physicalPath);
            defer.resolve('file uploaded to Kudu');
        }
        else {
            tl.debug("Action: uploadFiletoKudu, Response: " + JSON.stringify(response));
            defer.reject(tl.loc('failedtoUploadFileToKudu', fileName, kuduDeploymentURL, response.statusCode));
        }
    },
    (error) => {
        defer.reject(tl.loc('failedtoUploadFileToKuduError', fileName, kuduDeploymentURL));
    });

    return defer.promise;
}

async function deleteFileFromKudu(publishingProfile, physicalPath: string, fileName: string, continueOnError: boolean) {
    var defer = Q.defer<string>();
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*',
        'Content-Length': 0
    };
    var kuduDeploymentURL = "https://" + publishingProfile.publishUrl + "/api/vfs/" + physicalPath + '/' + fileName;

    tl.debug('Removing file: ' + fileName + ' using publishUrl: ' + kuduDeploymentURL);
    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.del(kuduDeploymentURL, options);
    promise.then((response) => {
        if(response.statusCode === 200 || response.statusCode === 204 || response.statusCode === 404) {
            tl.debug('Removed file: ' + fileName + ' from path: ' + physicalPath);
            defer.resolve('file removed from kudu');
        } else {
            if(continueOnError) {
                tl.debug('Unable to delete file: ' + fileName + ' using publishURL : ' + kuduDeploymentURL + '. statusCode: ' + response.statusCode);
                defer.resolve(' ');    
            }
            defer.reject(tl.loc('FailedtoDeleteFileFromKudu', fileName, kuduDeploymentURL, response.statusCode));
        }
    },
    (error) => {
        if(continueOnError) {
            tl.debug('Unable to delete file: ' + fileName + ' using publishURL : ' + kuduDeploymentURL + '. Error: ' + error);
            defer.resolve(' ');    
        }
        defer.reject(tl.loc('FailedtoDeleteFileFromKuduError', fileName, error));
    });

    return defer.promise;
}

async function getFileContentUtility(publishingProfile, physicalPath, fileName) {
    try {
        var fileContent: string =  (await getFileContent(publishingProfile, physicalPath, fileName))['content'];
        return fileContent;
    }
    catch(error) {
        if(error.error) {
            throw Error(tl.loc('FailedToGetKuduFileContentError', fileName, error.error));
        }
        else {
            throw Error(tl.loc('FailedToGetKuduFileContent', fileName, error.statusCode, error.statusMessage));
        }
    }
}

async function getFileContent(publishingProfile, physicalPath, fileName) {
    var defer = Q.defer();
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*'
    };
    var kuduGetFileUrl = "https://" + publishingProfile.publishUrl + "/api/vfs/" + physicalPath + "/" + fileName;
    tl.debug('Getting content of file: ' + fileName + ' using publishUrl: ' + kuduGetFileUrl);
    let promise: Promise<any> = hc.get(kuduGetFileUrl, headers);
    promise.then(async (response) => {
        let contents: string = "";
        try {
            contents = await response.readBody();
        } catch (error) {
            defer.reject(tl.loc("UnableToReadResponseBody", error));
        }
        if(response.message.statusCode === 200) {
            tl.debug('retrieved file content : ' + fileName);
            defer.resolve({
                content: contents
            });
        } else {
            defer.reject({
                statusCode: response.message.statusCode,
                statusMessage: response.message.statusMessage
            });
        }
    },
    (error) => {
        defer.reject({ error: error + ''});
    });

    return defer.promise;
}

/**
 * Poll for a file in Kudu
 * @param publishingProfile publishing profile of App Service (contains credentials for web deploy)
 * @param physicalPath Path where to look for file
 * @param fileName File name
 * @param noOfRetry max. no. of retry.
 * @param checkForFileExists If set, then poll until the file exists else poll until the file is removed by other process
 */
async function pollForFile(publishingProfile, physicalPath: string, fileName: string, noOfRetry: number, fileAction: string) {
    var defer = Q.defer();
    var attempts: number = 0;
    if(tl.getVariable('appservicedeploy.retrytimeout')) {
        noOfRetry = Number(tl.getVariable('appservicedeploy.retrytimeout')) * 6;
        tl.debug('Retry timeout provided by user: ' + noOfRetry);
    }
    tl.debug('Polling started for file: ' + fileName + ' to ' + fileAction);
    var poll = async function () {
        if (attempts < noOfRetry) {
            attempts += 1;
            try {
                var fileContent = (await getFileContent(publishingProfile, physicalPath, fileName))['content'];
                if(fileAction  === 'CheckFileExists') {
                    tl.debug('Found file:  ' + fileName);
                    defer.resolve(fileContent);
                }
                else if(fileAction === 'CheckFileNotExists') {
                    tl.debug('File: ' + fileName + 'found. retry after 10 seconds. Attempt: ' + attempts);
                    setTimeout(poll, 10000);
                }
                else {
                    defer.reject(tl.loc('InvalidPollOption', fileAction));
                }
            }
            catch(error) {
                if(error.statusCode === 404) {
                    if(fileAction  === 'CheckFileExists') {
                        tl.debug('File ' + fileName + ' not found. retry after 10 seconds. Attempt : ' + attempts);
                        setTimeout(poll, 10000);
                    }
                    else if(fileAction === 'CheckFileNotExists') {
                        tl.debug('File: ' + fileName + 'not found.');
                        defer.resolve();
                    }
                    else {
                        defer.reject(tl.loc('InvalidPollOption', fileAction));
                    }
                }
                else {
                    if(error.error) {
                        defer.reject(tl.loc('FailedToGetKuduFileContentError', fileName, error.error));
                    }
                    else {
                        defer.reject(tl.loc('FailedToGetKuduFileContent', fileName, error.statusCode, error.statusMessage));
                    }
                }
            }
        }
        else {
            tl.warning(tl.loc('PollingForFileTimeOut'));
            defer.reject(tl.loc('ScriptStatusTimeout'));
        }
    }
    poll();
    return defer.promise;
}

async function getPostDeploymentScriptLogs(publishingProfile, physicalPath, uniqueID) {

    try {
        var stdoutLog = (await getFileContentUtility(publishingProfile, physicalPath, 'stdout_' + uniqueID + '.txt'));
        var stderrLog = (await getFileContentUtility(publishingProfile, physicalPath, 'stderr_' + uniqueID + '.txt'));
        var scriptReturnCode = ((await getFileContentUtility(publishingProfile, physicalPath, 'script_result_' + uniqueID + '.txt')).trim());
    }
    catch(error) {
        throw Error(error);
    }
   if(stdoutLog) {
        console.log(tl.loc('stdoutFromScript'));
        console.log(stdoutLog);
    }
    if(stderrLog) {
        console.log(tl.loc('stderrFromScript'));
        if(scriptReturnCode != '0') {
            tl.error(stderrLog);
            throw Error(tl.loc('ScriptExecutionOnKuduFailed', scriptReturnCode, stderrLog));
        }
        else {
            console.log(stderrLog);
        }
    }
}

/**
 * Run given command on Kudu
 * @param publishingProfile Publishing profile
 * @param physicalPath Path where to run the command
 * @param command command to run
 * @param timeout if timeOut is 0, then runs command synchronously, else run command async and polls for given file [within the time limit (in Minutes)]
 * @param pollFile poll for file if command runs async 
 * @returns {ExitCode, Stdout, Stderr} for sync and {pollFileContent} for async call
 */
async function runCommandOnKudu(publishingProfile, physicalPath: string, command: string, timeOut: number, pollFile: string) {
    var defer = Q.defer();
    var kuduDeploymentURL = "https://" + publishingProfile.publishUrl + "/api/command";
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*',
        'Content-Type': 'application/json'
    };
    var jsonData = {
        'command': command,
        'dir': physicalPath
    };

    tl.debug('Executing Script on Kudu: ' + kuduDeploymentURL + '. Command: ' + command + '. runAsync : ' + (timeOut > 0));
    let options: rm.IRequestOptions = {};
    options.additionalHeaders = headers;
    let promise: Promise<any> = rc.create(kuduDeploymentURL, jsonData, options);
    promise.then(async (response) => {
        if(response.statusCode === 200) {
            tl.debug('successfully executed script on kudu');
            tl.debug('Response from Kudu: ' + JSON.stringify(response.result));
            if(timeOut > 0) {
                tl.debug('Async command execution completed. polling for file: ' + pollFile);
                try {
                    defer.resolve( {
                        'pollFileContent': await pollForFile(publishingProfile, physicalPath, pollFile, timeOut * 6, 'CheckFileExists')
                    });
                }
                catch(pollError) {
                    defer.reject(pollError);
                }
            }
            defer.resolve(response.result);
        }
        else {
            defer.reject(tl.loc('FailedToRunScriptOnKudu', kuduDeploymentURL, response.statusCode));
        }
    },
    async (error) => {
        if(timeOut > 0 && error.toString().indexOf('Request timeout: /api/command') != -1) {
            tl.debug('Request timeout occurs. Trying to poll for file: ' + pollFile);
            try {
                defer.resolve( {
                    'pollFileContent': await pollForFile(publishingProfile, physicalPath, pollFile, timeOut * 6, 'CheckFileExists')
                });
            }
            catch(pollError) {
                defer.reject(pollError);
            }
        }
        defer.reject(tl.loc('FailedToRunScriptOnKuduError', kuduDeploymentURL, error));
    });

    return defer.promise;
}
