import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
import httpClient = require('vso-node-api/HttpClient');
var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var gulp = require('gulp');
var zip = require('gulp-zip');
var zipUtility = require('webdeployment-common/ziputility.js');

export async function appOffineKuduService(publishUrl: string, physicalPath: string, headers, enableFeature: boolean) {
    var defer = Q.defer<string>();
    var kuduDeploymentURL = "https://" + publishUrl + "/api/vfs/" + physicalPath + '/app_offline.htm';
    if(enableFeature) {
        var offlineFilePath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'app_offline.htm');
        fs.writeFileSync(offlineFilePath, '<h1>The Web Page is temporarily unavailable !</h1>');
        var webAppReadStream = fs.createReadStream(offlineFilePath);
        httpObj.sendFile('PUT', kuduDeploymentURL, webAppReadStream, headers, (error, response, body) => {
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
    var physicalPath = "/site/wwwroot";
    var virtualPath = "/";
    if (virtualApplication) {
        virtualPath = "/" + virtualApplication;
    }

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
    tl._writeLine(tl.loc("Deployingwebapplicationatvirtualpathandphysicalpath", webAppPackage, virtualPath, physicalPath));
    var webAppReadStream = fs.createReadStream(webAppPackage);
    httpObj.sendFile('PUT', kuduDeploymentURL, webAppReadStream, headers, async (error, response, body) => {
        if(error) {
            deferred.reject(tl.loc("Failedtodeploywebapppackageusingkuduservice", error));
        }
        else if(response.statusCode === 200) {
            tl._writeLine(tl.loc("Successfullydeployedpackageusingkuduserviceat", webAppPackage, publishingProfile.publishUrl));
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

/**
 * Check whether the package contains parameter.xml file
 * @param   webAppPackage   web deploy package
 * @returns boolean
 */
export async  function containsParamFile(webAppPackage: string ) {
    var isParamFilePresent = false;
    var pacakgeComponent = await zipUtility.getArchivedEntries(webAppPackage);
    if ((pacakgeComponent["entries"].indexOf("parameters.xml") > -1) || (pacakgeComponent["entries"].indexOf("Parameters.xml") > -1)) {
        isParamFilePresent = true;
    }
    tl.debug(tl.loc("Isparameterfilepresentinwebpackage0", isParamFilePresent));
    return isParamFilePresent;
}