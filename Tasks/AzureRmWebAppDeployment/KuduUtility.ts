/// <reference path="../../definitions/vso-node-api.d.ts" />

import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
import httpClient = require('vso-node-api/httpClient');
var httpObj = new httpClient.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"));
var archiver = require('archiver');

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
export async function deployWebAppPackage(webAppPackage: string, publishingProfile, virtualPath: string, physicalPath: string) {

    var deferred = Q.defer<any>();
    tl.debug(tl.loc("Deployingwebapplicationatvirtualpathandphysicalpath", webAppPackage, virtualPath, physicalPath));
    var kuduDeploymentURL = "https://" + publishingProfile.publishUrl + "/api/zip/" + physicalPath;
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    var headers = {
        'Authorization': basicAuthToken,
        'content-type': 'multipart/form-data'
    };

    var webAppReadStream = fs.createReadStream(webAppPackage);
    httpObj.sendFile('PUT', kuduDeploymentURL, webAppReadStream, headers, (error, response, body) => {
        if(error) {
            deferred.reject(tl.loc("Failedtodeploywebapppackageusingkuduservice", error));
        }
        else if(response.statusCode === 200) {
             tl._writeLine(tl.loc("Successfullydeployedpackageusingkuduserviceat", webAppPackage, publishingProfile.publishUrl));
             tl.resolve(tl.loc("Successfullydeployedpackageusingkuduserviceat", webAppPackage, publishingProfile.publishUrl));
        }
        else {
            tl.error(response.statusMessage);
            deferred.reject(tl.loc('Unabletodeploywebappresponsecode', response.statusCode));
        }
    });
    return deferred.promise;
}

export async function archiveFolder(webAppFolder:string , webAppZipFile:string ) {
    var deferred = Q.defer<string>();
    var output = fs.createWriteStream(webAppZipFile);
    var archive = archiver('zip');
    output.on('close', function () {
        tl.debug(tl.loc("Webappfolderisbeingarchivedtobytescompressed", webAppFolder, webAppZipFile, archive.pointer()));
        deferred.resolve(tl.loc("Webappfolderisbeingarchivedtobytescompressed", webAppFolder, webAppZipFile, archive.pointer()));
    });
    archive.on('error', function (err) {
        deferred.reject(tl.loc("Unabletopackagecontentoffolder",err));
        throw new Error(err);
    });
    archive.pipe(output);
    archive.bulk([
        { expand: true, cwd: webAppFolder, src: ['**'] }
    ]);
    await archive.finalize();
    return deferred.promise;
}