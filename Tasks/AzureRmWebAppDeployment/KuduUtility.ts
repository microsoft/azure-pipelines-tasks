import Q = require('q');
import tl = require('vsts-task-lib/task');
import path = require("path");
import fs = require("fs");
var request = require ('request');
var archiver = require('archiver');


/**
 *  Deploys a zip based webapp package.
 * 
 *  @param  webAppPackage                  Zip file or folder for deployment
 *  @param  virtualApplicationMappings     Mapping to get physical path for deployment
 *  @param  publishingProfile              publish profile provides destination details for deployment
 *  @param  virtualApplication             (Optional) Virtual application name 
 */
export async function deployWebAppPackage(webAppPackage: string, virtualApplicationMappings, publishingProfile,
                             virtualApplication: string) {

    var deferred = Q.defer<any>();	
    // construct URL depending on virtualApplication or root of webapplication 
    var physicalDeploymentPath = "/site/wwwroot";
    var virtualPath = "/";
    if (virtualApplication) {
		virtualPath = "/" + virtualApplication;
    }

    for( var index in virtualApplicationMappings ){
        var mapping = virtualApplicationMappings[index];
        if( mapping.virtualPath == virtualPath){
            physicalDeploymentPath = mapping.physicalPath;
            break;
        }
    }

    tl.debug(tl.loc("Deployingwebapplicationatvirtualpathandphysicalpath", virtualPath, physicalDeploymentPath));

    var kuduDeploymentURL = "https://" + publishingProfile.publishUrl + "/api/zip/" + physicalDeploymentPath;
    var basicAuthToken = 'Basic ' + new Buffer(publishingProfile.userName + ':' + publishingProfile.userPWD).toString('base64');
    await fs.createReadStream(webAppPackage).pipe(request.put({ url: kuduDeploymentURL, headers: {
            'Authorization': basicAuthToken,
            'content-type': 'multipart/form-data'
        } }, function (error, response) {
            if (error){
                deferred.reject(tl.loc("Failedtodeploywebapppackageusingkuduservice",error));
            } else if(response.statusCode === 200) {
                tl._writeLine(tl.loc("Successfullydeployedusingkuduservice"));
                deferred.resolve(tl.loc("Successfullydeployedusingkuduservice"))
            }
            else {
                deferred.reject(tl.loc('Unabletodeploywebappresponsecode', response.statusCode));
            }
    }));
    return deferred.promise;
}

function onError(error) {
    tl.setResult(tl.TaskResult.Failed, error);
    process.exit(1);
}




export async function archiveFolder(webAppPackage:string , webAppZipFile:string ){
    
    var deferred = Q.defer<string>();
    var output = fs.createWriteStream(webAppZipFile);
    var archive = archiver('zip');
    output.on('close', function () {
        console.log(archive.pointer() + ' bytes compressed');
        deferred.resolve(archive.pointer() + ' bytes compressed');
    });
    archive.on('error', function (err) {
        deferred.reject(tl.loc("Unabletopackagecontentoffolder",err));
        throw err;
    });
    archive.pipe(output);
    archive.bulk([
        { expand: true, cwd: webAppPackage, src: ['**'] }
    ]);
    await archive.finalize();
    return deferred.promise;
}




