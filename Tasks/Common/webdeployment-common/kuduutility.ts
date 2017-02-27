import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
import httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpCallbackClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var fileEncoding = require('./fileencoding.js');

export async function appOffineKuduService(publishUrl: string, physicalPath: string, headers, enableFeature: boolean) {
    var defer = Q.defer<string>();
    var kuduDeploymentURL = "https://" + publishUrl + "/api/vfs/" + physicalPath + '/app_offline.htm';
    if(enableFeature) {
        var offlineFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'app_offline.htm');
        fs.writeFileSync(offlineFilePath, '<h1>The Web Page is temporarily unavailable !</h1>');
        var webAppReadStream = fs.createReadStream(offlineFilePath);
        httpObj.sendStream('PUT', kuduDeploymentURL, webAppReadStream, headers, (error, response, body) => {
            if (error) {
                defer.reject(error);
            }
            else if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 204) {
                tl.debug('App Offline Mode Enabled at ' + physicalPath);
                defer.resolve(tl.loc('AppOfflineModeenabled'));
            }
            else {
                tl.error(response.statusMessage);
                defer.reject(tl.loc('Failedtoenableappofflinemode', response.statusCode, response.statusMessage));
            }
        });
    }
    else {
        headers['Content-Length'] = 0;
        httpObj.get('DELETE', kuduDeploymentURL, headers, (error, response, contents) => {
             if(error) {
                defer.reject(error);
            }
            else if(response.statusCode === 200 || response.statusCode === 204) {
                tl.debug('Removed app_offline.htm from ' + physicalPath);
                defer.resolve(tl.loc('AppOflineModedisabled'));
            }
            else {
                tl.error(contents);
                defer.reject(tl.loc('FailedtodisableAppOfflineMode', response.statusCode, response.statusMessage));
            }
        });
    }
    return defer.promise;
}

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
        await appOffineKuduService(publishingProfile.publishUrl, physicalPath, headers, true); 
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
                    await appOffineKuduService(publishingProfile.publishUrl, physicalPath, headers, false);
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

async function uploadFiletoKudu(publishUrl: string, physicalPath: string, headers, fileName: string, fileContent: string) {
    var defer = Q.defer<string>();
    var kuduDeploymentURL = "https://" + publishUrl + "/api/vfs/" + physicalPath + '/' + fileName;

    tl.debug('Uploading file: ' + fileName + ' using publishUrl: ' + kuduDeploymentURL);
    httpObj.send('PUT', kuduDeploymentURL, fileContent, headers, (error, response, body) => {
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

async function deteteFileFromKudu(publishUrl: string, physicalPath: string, headers, fileName: string) {
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

async function runCommandOnKudu(publishUrl: string, physicalPath: string, headers, command: string) {
    var defer = Q.defer<string>();
    var kuduDeploymentURL = "https://" + publishUrl + "/api/command";
    headers['Content-Type'] = 'application/json';
    var jsonData = {
        'command': command,
        'dir': physicalPath
    };

    tl.debug('Executing Script on Kudu: ' + kuduDeploymentURL + '. Command: ' + command);
    httpObj.send('POST', kuduDeploymentURL, JSON.stringify(jsonData), headers, (error, response, body) => {
        if(error) {
            defer.reject(tl.loc('FailedToRunScriptOnKuduError', kuduDeploymentURL, error));
        }
        else if(response.statusCode === 200) {
            var responseBody = JSON.parse(body);
            console.log(responseBody.Output);
            if(responseBody.ExitCode === 0) {
            console.log(responseBody.Error);
                defer.resolve(tl.loc('SciptExecutionOnKuduSuccess'));
            }
            else {
                tl.error(responseBody.Error);
                defer.reject(tl.loc('SciptExecutionOnKuduFailed', responseBody.ExitCode, responseBody.Error));
            }
        }
        else {
            defer.reject(tl.loc('FailedToRunScriptOnKudu', kuduDeploymentURL, response.statusCode, response.statusMessage));
        }
    });
    return defer.promise;
}

export async function runPostDeploymentScript(publishingProfile, scriptType, inlineScript, scriptPath, appOfflineFlag) {

    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'If-Match': '*'
    };
    var scriptContent = '';

    if(scriptType === 'Inline Script') {
        scriptContent = inlineScript;
    }
    else {
        var fileBuffer: Buffer = fs.readFileSync(scriptPath);
        var encodingType = fileEncoding.detectFileEncoding( scriptPath, fileBuffer);
        var scriptFileContent: string = fileBuffer.toString(encodingType[0]);
        if(encodingType[1]) {
            scriptFileContent = scriptFileContent.slice(1);
        }
        scriptContent = scriptFileContent;
    }

    if(appOfflineFlag) {
        await appOffineKuduService(publishingProfile.publishUrl, 'site/wwwroot', headers, true);
    }

    try {
        await uploadFiletoKudu(publishingProfile.publishUrl, '/site/wwwroot', headers, 'kuduPostDeploymentScript.cmd', scriptContent);
        console.log(tl.loc('ExecuteScriptOnKudu', publishingProfile.publishUrl));
        console.log(await runCommandOnKudu(publishingProfile.publishUrl, 'site\\wwwroot', headers, 'kuduPostDeploymentScript.cmd'));
        await deteteFileFromKudu(publishingProfile.publishUrl, '/site/wwwroot', headers, 'kuduPostDeploymentScript.cmd');
    }
    catch(Exception) {
        throw Error(Exception);
    }
    finally {
        if(appOfflineFlag) {
            await appOffineKuduService(publishingProfile.publishUrl, 'site/wwwroot', headers, false);
        }
    }
}