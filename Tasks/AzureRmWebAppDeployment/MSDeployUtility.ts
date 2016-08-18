/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
import Q = require('q');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

var regedit = require('regedit');
var azureRmUtil = require('./AzureRMUtil.js');

//Error Handler
var onError = function(error) {
	tl.error(error);
	process.exit(1);
}


function isFileExists(filePath: string) : boolean {
    try{
        return fs.statSync(filePath).isFile();
    }
    catch(e) {
        onError("Cannot access "+filePath+" in machine");
        return false;
    }
}
module.exports.isFileExists = isFileExists;

function getWebAppNameForMSDeployCmd(webAppName: string, deployToSlotFlag: boolean, slotName: string) : string {
    if(deployToSlotFlag) {
        webAppName = webAppName + "(" + slotName + ")";
    }
    tl.debug("WebApp Name to be used in msdeploy command is: "+webAppName);
    return webAppName;
}
module.exports.getWebAppNameForMSDeployCmd = getWebAppNameForMSDeployCmd;

//Get Parameters for MSDeploy Command
function getMSDeployCmdArgs(packageFile: string, webAppNameForMSDeployCmd: string, azureRMWebAppConnectionDetails: Array<String>, removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean,
                            takeAppOfflineFlag: boolean, virtualApplication: string, setParametersFile: string, additionalArguments: string) : string {

    // msdeploy argument containing source and destination details to sync
    var msDeployCmdArgs: string = " -verb:sync";
    msDeployCmdArgs += " -source:package='"+packageFile+"'";
    msDeployCmdArgs += " -dest:auto,ComputerName='https://"+azureRMWebAppConnectionDetails["KuduHostName"]+"/msdeploy.axd?site="+webAppNameForMSDeployCmd+"',";
    msDeployCmdArgs += "UserName='"+azureRMWebAppConnectionDetails["UserName"]+"',Password='"+azureRMWebAppConnectionDetails["UserPassword"]+"',AuthType='Basic'";

    // msdeploy argument to set destination IIS App Name for deploy
    if(virtualApplication) {
        msDeployCmdArgs += " -setParam:name='IIS Web Application Name',value='"+webAppNameForMSDeployCmd+"/"+virtualApplication+"'";
    }
    else {
        msDeployCmdArgs += " -setParam:name='IIS Web Application Name',value='"+webAppNameForMSDeployCmd+"'";
    }

    // msdeploy argument to block deletion from happening
    if(!removeAdditionalFilesFlag) {
        msDeployCmdArgs += " -enableRule:DoNotDeleteRule";
    }

    // msdeploy argument to take app offline
    if(takeAppOfflineFlag) {
        msDeployCmdArgs +=  " -enableRule:AppOffline";
    }

    // msdeploy argument to exclude files in App_Data folder
    if(excludeFilesFromAppDataFlag) {
        msDeployCmdArgs += " -skip:Directory='\\App_Data'";
    }

    // msdeploy argument to set paramater files
    if(setParametersFile) {
        msDeployCmdArgs += " -setParamFile:'"+setParametersFile+"'";
    }

    // msdeploy additional arguments
    if(additionalArguments) {
        msDeployCmdArgs += " "+additionalArguments;
    }

    var userAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");
    if(userAgent) {
        msDeployCmdArgs += " -userAgent:'"+userAgent+"'";
    }

    tl.debug("Constructed msdeploy command arguments to deploy to deploy to azureRM WebApp: "+webAppNameForMSDeployCmd+
            " from source Web App zip package: "+packageFile);
    
    return msDeployCmdArgs;
}
module.exports.getMSDeployCmdArgs = getMSDeployCmdArgs;

function getMSDeployCmdForLogs(msDeployCmdArgs: string) : string {
    var msDeployCmdSplitByComma = msDeployCmdArgs.split(",");
    var msDeployCmdArray = [];
    for(var msDeployCommandAttr in msDeployCmdSplitByComma) {
        if(msDeployCmdSplitByComma[msDeployCommandAttr].indexOf('Password=') === 0) {
            msDeployCmdArray.push("Password=*****");
        }
        else {
            msDeployCmdArray.push(msDeployCmdSplitByComma[msDeployCommandAttr]);
        }
    }
    return msDeployCmdArray.join(",");
}

function runMSDeployCommand(msDeployExePath: string, msDeployCmdArgs: string, azureRMWebAppConnectionDetails) {
    var msDeployCmdForLogs = getMSDeployCmdForLogs(msDeployCmdArgs);
    tl.debug("[command] "+msDeployExePath+" "+msDeployCmdForLogs);

    tl.exec(msDeployExePath, msDeployCmdArgs)
    .then(function(code){
      azureRmUtil.updateDeploymentStatus(azureRMWebAppConnectionDetails, true);
        console.log("MSDeploy executed Successfully !");
        tl.debug("Return Code : " + code);
    },
    function(error) {
       azureRmUtil.updateDeploymentStatus(azureRMWebAppConnectionDetails, false);
        tl.error("MSDeploy failed !");
        onError(error);
    });
}

// Get the latest version of MSDeploy installed
function getMSDeployVersion(registryKey: string) : Q.Promise<String> {
    var defer = Q.defer<String>();
    regedit.list(registryKey)
    .on('data', function(entry) {
        var keys = entry.data.keys;
        keys.sort();
        defer.resolve(keys[keys.length-1]);
    })
    .on('error', function(error) {
        defer.reject(error);
    });
    
    return defer.promise;
}

//Get the absolut path of MSDeploy.exe
function getMSDeployInstallPath(registryKey: string) : Q.Promise<string> {
    var defer = Q.defer<string>();
    regedit.list(registryKey)
    .on('data', function(entry) {
        defer.resolve(entry.data.values.InstallPath.value);
    })
    .on('error', function(error) {
        defer.reject(error);
    });

    return defer.promise;
}

//
function runMSDeployCommandWrapper(msDeployCmdArgs: string, azureRMWebAppConnectionDetails): void {
    var msDeployInstallPathRegKey = "HKLM\\SOFTWARE\\Microsoft\\IIS Extensions\\MSDeploy";
    getMSDeployVersion(msDeployInstallPathRegKey)
    .then(function(version){
        var msDeployLatestPathRegKey = msDeployInstallPathRegKey+"\\"+version;
        getMSDeployInstallPath(msDeployLatestPathRegKey)
        .then(function(msDeployPath) {
            //Append msdeploy.exe to get the absolute path
            msDeployPath = msDeployPath+"\\msdeploy.exe";
            runMSDeployCommand(msDeployPath, msDeployCmdArgs, azureRMWebAppConnectionDetails);
        },
        function(error) {
            onError(error);
        });
    },
    function(error) {
        onError(error);
    });
}
module.exports.runMSDeployCommandWrapper = runMSDeployCommandWrapper;
