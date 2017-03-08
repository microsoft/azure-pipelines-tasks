import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
import httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var fileEncoding = require('./fileencoding.js');

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
        tl.debug('Trying to enable app offline mode.');
        var appOfflineFilePath = path.join(tl.getVariable('system.DefaultWorkingDirectory'), 'app_offline_temp.htm');
        tl.writeFile(appOfflineFilePath, '<h1>App Service is offline.</h1>');
        await uploadFiletoKudu(publishingProfile.publishUrl, '/site/wwwroot', headers, 'app_offline.htm', appOfflineFilePath);
        tl.debug('App Offline mode enabled.');
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
                    await deleteFileFromKudu(publishingProfile.publishUrl, physicalPath, headers, 'app_offline.htm');
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

async function uploadFiletoKudu(publishUrl: string, physicalPath: string, headers, fileName: string, filePath: string) {
    var defer = Q.defer<string>();
    var readStream = fs.createReadStream(filePath);
    var kuduDeploymentURL = "https://" + publishUrl + "/api/vfs/" + physicalPath + '/' + fileName;

    tl.debug('Uploading file: ' + fileName + ' using publishUrl: ' + kuduDeploymentURL);
    httpObj.sendStream('PUT', kuduDeploymentURL, readStream, headers, (error, response, body) => {
        if (error) {
            defer.reject(tl.loc('failedtoUploadFileToKuduError', fileName, kuduDeploymentURL));
        }
        else if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
            tl.debug('file: ' + fileName + ' uploaded at path: ' + physicalPath);
            defer.resolve('file uploaded to Kudu');
        }
        else {
            defer.reject(tl.loc('failedtoUploadFileToKudu', fileName, kuduDeploymentURL, response.statusCode, response.statusMessage));
        }
    });
    return defer.promise;
}

async function deleteFileFromKudu(publishUrl: string, physicalPath: string, headers, fileName: string) {
    var defer = Q.defer<string>();
    var kuduDeploymentURL = "https://" + publishUrl + "/api/vfs/" + physicalPath + '/' + fileName;
    headers['Content-Length'] = 0;

    tl.debug('Removing file: ' + fileName + ' using publishUrl: ' + kuduDeploymentURL);
    httpObj.get('DELETE', kuduDeploymentURL, headers, (error, response, contents) => {
        if(error) {
            defer.reject(tl.loc('FailedtoDeleteFileFromKuduError', fileName, kuduDeploymentURL));
        }
        else if(response.statusCode === 200 || response.statusCode === 204) {
            tl.debug('file: ' + fileName + ' removed from path: ' + physicalPath);
            defer.resolve('file removed from kudu');
        }
        else {
            defer.reject(tl.loc('FailedtoDeleteFileFromKuduError', fileName, kuduDeploymentURL, response.statusCode, response.statusMessage));
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

async function pollForFile(publishingProfile, physicalPath, fileName) {
    var defer = Q.defer();
    var attempts = 0;
    tl.debug('Polling started for file: ' + fileName);
    var poll = async function () {
        if (attempts < 180) {
            attempts += 1;
            var fileContent;
            try {
                fileContent = await getFileContent(publishingProfile, physicalPath, fileName);
                tl.debug('Found file:  ' + fileName);
                defer.resolve('');
            }
            catch(error) {
                if(error.statusCode === 404) {
                    tl.debug('File ' + fileName + ' not found. rerty after 10 seconds. Attempt : ' + attempts);
                    setTimeout(poll, 10000);
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
            defer.reject(tl.loc('ScriptStatusTimeout'));
        }
    }
    poll();
    return defer.promise;
}

async function getPosDeploymentScriptLogs(publishingProfile, physicalPath) {
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*'
    };
    try {
        var stdoutLog = (await getFileContentUtility(publishingProfile, physicalPath, 'stdout.txt'));
        var stderrLog = (await getFileContentUtility(publishingProfile, physicalPath, 'stderr.txt'));
        var scriptReturnCode = (await getFileContentUtility(publishingProfile, physicalPath, 'script_result.txt')).trim();
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
        console.log(stderrLog);
        if(scriptReturnCode != '0') {
            tl.error(stderrLog);
            throw Error(tl.loc('SciptExecutionOnKuduFailed', scriptReturnCode, stderrLog));
        }
    }
}
async function runCommandOnKudu(publishingProfile, physicalPath: string, command: string) {
    var defer = Q.defer<string>();
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

    tl.debug('Executing Script on Kudu: ' + kuduDeploymentURL + '. Command: ' + command);
    httpObj.send('POST', kuduDeploymentURL, JSON.stringify(jsonData), headers, async (error, response, body) => {
        if(error) {
            if(error.toString().indexOf('Request timeout: /api/command') != -1) {
                tl.debug('Request timeout occurs. Trying to poll for file: script_result.txt');
                try {
                    await pollForFile(publishingProfile, physicalPath, 'script_result.txt');
                    defer.resolve('');
                }
                catch(error) {
                    defer.reject(error);
                }
            }
            defer.reject(tl.loc('FailedToRunScriptOnKuduError', kuduDeploymentURL, error));
        }
        else if(response.statusCode === 200) {
            defer.resolve(tl.loc('SciptExecutionOnKuduSuccess'));
        }
        else {
            defer.reject(tl.loc('FailedToRunScriptOnKudu', kuduDeploymentURL, response.statusCode, response.statusMessage));
        }
    });
    return defer.promise;
}

function getPostDeploymentScript(scriptType, inlineScript, scriptPath) {
    if(scriptType === 'Inline Script') {
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
    return {
        filePath: scriptPath,
        isCreated: false
    }
}

export async function runPostDeploymentScript(publishingProfile, scriptType, inlineScript, scriptPath, appOfflineFlag) {

    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*'
    };
    var scriptFile = getPostDeploymentScript(scriptType, inlineScript, scriptPath);

    if(appOfflineFlag) {
        var appOfflineFilePath = path.join(tl.getVariable('system.DefaultWorkingDirectory'), 'app_offline_local.htm');
        tl.writeFile(appOfflineFilePath, '<h1>App Service is offline.</h1>');
        await uploadFiletoKudu(publishingProfile.publishUrl, 'site/wwwroot', headers, 'app_offline.htm', appOfflineFilePath);
    }

    try {
        var mainCmdFilePath = path.join(tl.getVariable('system.DefaultWorkingDirectory'), 'mainFile_local.cmd');
        tl.writeFile(mainCmdFilePath, "@echo off\ndel script_result.txt /F /Q\ncall kuduPostDeploymentScript.cmd > stdout.txt 2> stderr.txt\necho %errorlevel% > script_result.txt");
        await uploadFiletoKudu(publishingProfile.publishUrl, 'site/wwwroot', headers, 'mainCmdFile.cmd', mainCmdFilePath);
        await uploadFiletoKudu(publishingProfile.publishUrl, 'site/wwwroot', headers, 'kuduPostDeploymentScript.cmd', scriptFile.filePath);
        console.log(tl.loc('ExecuteScriptOnKudu', publishingProfile.publishUrl));
        console.log(await runCommandOnKudu(publishingProfile, 'site\\wwwroot', 'mainCmdFile.cmd'));
        await getPosDeploymentScriptLogs(publishingProfile, 'site/wwwroot');
    }
    catch(Exception) {
        throw Error(Exception);
    }
    finally {
        if(scriptFile.isCreated) {
            tl.rmRF(scriptFile.filePath, true);
        }
        tl.rmRF(mainCmdFilePath, true);
        try {
            await deleteFileFromKudu(publishingProfile.publishUrl, 'site/wwwroot', headers, 'mainCmdFile.cmd');
        }
        catch(error) {
            tl.debug('Unable to remove mainCmdFile.cmd. Error: ' + error);
        }
        try {
            await deleteFileFromKudu(publishingProfile.publishUrl, 'site/wwwroot', headers, 'kuduPostDeploymentScript.cmd');    
        }
        catch(error) {
            tl.debug('Unable to remove kuduPostDeploymentScript.cmd. Error: ' + error);
        }
        if(appOfflineFlag) {
            await deleteFileFromKudu(publishingProfile.publishUrl, 'site/wwwroot', headers, 'app_offline.htm');
            tl.rmRF(appOfflineFilePath, true);
        }
    }
}