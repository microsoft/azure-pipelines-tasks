import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
import httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
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
        if( mapping.virtualPath == virtualPath){
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
    httpObj.sendStream('PUT', kuduDeploymentURL, webAppReadStream, headers, async (error, response, body) => {
        if(error) {
            deferred.reject(tl.loc("Failedtodeploywebapppackageusingkuduservice", error));
        }
        else if(response.statusCode === 200) {
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
            tl.error(response.statusMessage);
            deferred.reject(tl.loc('Unabletodeploywebappresponsecode', response.statusCode, response.statusMessage));
        }
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

    httpObj.send('GET', kuduPhysicalpathUrl, null, headers, async (error, response, body) => {
        if (error) {
            defer.reject(error);
        }
        else if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug("Physical path '" + physicalPath + "' already exists ");
            defer.resolve(tl.loc('Physicalpathalreadyexists'));
        }
        else if(response.statusCode === 404) {
            tl.debug("Physical path doesn't exists. Creating physical path.")
            defer.resolve(await createPhysicalPath(publishingProfile, physicalPath));
        } else {
            tl.debug(body);
            defer.reject(tl.loc('FailedtocheckphysicalPath', response.statusCode, response.statusMessage));
        }
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
    httpObj.send('PUT', kuduPhysicalpathUrl, null, headers, (error, response, body) => {
        if (error) {
            defer.reject(error);
        }
        else if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug("Kudu physical path : '" + physicalPath + "' created successfully ");
            defer.resolve(tl.loc('KuduPhysicalpathCreatedSuccessfully', physicalPath));
        }
        else {
            tl.error(response.statusMessage);
            defer.reject(tl.loc('FailedtocreateKuduPhysicalPath', response.statusCode, response.statusMessage));
        }
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
    httpObj.sendStream('PUT', kuduDeploymentURL, readStream, headers, (error, response, body) => {
        if (error) {
            defer.reject(tl.loc('failedtoUploadFileToKuduError', fileName, kuduDeploymentURL));
        }
        else if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug('Uploaded file: ' + fileName + ' at path: ' + physicalPath);
            defer.resolve('file uploaded to Kudu');
        }
        else {
            defer.reject(tl.loc('failedtoUploadFileToKudu', fileName, kuduDeploymentURL, response.statusCode, response.statusMessage));
        }
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
    httpObj.get('DELETE', kuduDeploymentURL, headers, (error, response, contents) => {
        if(response.statusCode === 200 || response.statusCode === 204 || response.statusCode === 404) {
            tl.debug('Removed file: ' + fileName + ' from path: ' + physicalPath);
            defer.resolve('file removed from kudu');
        }
        else if(error) {
            if(continueOnError) {
                tl.debug('Unable to delete file: ' + fileName + ' using publishURL : ' + kuduDeploymentURL + '. Error: ' + error);
                defer.resolve(' ');    
            }
            defer.reject(tl.loc('FailedtoDeleteFileFromKuduError', fileName, error));
        }
        else {
            if(continueOnError) {
                tl.debug('Unable to delete file: ' + fileName + ' using publishURL : ' + kuduDeploymentURL + '. statusCode: ' + response.statusCode + ' (' + response.statusMessage + ')');
                defer.resolve(' ');    
            }
            defer.reject(tl.loc('FailedtoDeleteFileFromKudu', fileName, kuduDeploymentURL, response.statusCode, response.statusMessage));
        }
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
    httpObj.get('GET', kuduGetFileUrl, headers, (error, response, body) => {
        if(error) {
            defer.reject({ error: error + ''});
        }
        else if(response.statusCode === 200) {
            tl.debug('retrieved file content : ' + fileName);
            defer.resolve({
                content: body
            });
        }
        else {
            defer.reject(
                {
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage 
                }
            );
        }
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
    httpObj.send('POST', kuduDeploymentURL, JSON.stringify(jsonData), headers, async (error, response, body) => {
        if(error) {
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
        }
        else if(response.statusCode === 200) {
            tl.debug('successfully executed script on kudu');
            tl.debug('Response from Kudu: ' + body);
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
            defer.resolve(JSON.parse(body));
        }
        else {
            defer.reject(tl.loc('FailedToRunScriptOnKudu', kuduDeploymentURL, response.statusCode, response.statusMessage));
        }
    });
    return defer.promise;
}
