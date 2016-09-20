/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

var winreg = require('winreg');
var azureRmUtil = require('./azurermutil.js');
var parseString = require('xml2js').parseString;

/**
 * Constructs argument for MSDeploy command
 * 
 * @param   webAppPackage                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   publishingProfile               Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 * @param   isParamFilePresentInPacakge     Flag to check Paramter.xml file
 * @param   isFolderBasedDeployment         Flag to check if given web package path is a folder
 * 
 * @returns string 
 */
export function getMSDeployCmdArgs(webAppPackage: string, webAppName: string, publishingProfile,
                             removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean, takeAppOfflineFlag: boolean,
                             virtualApplication: string, setParametersFile: string, additionalArguments: string, isParamFilePresentInPacakge: boolean, isFolderBasedDeployment: boolean) : string {

    var msDeployCmdArgs: string = " -verb:sync";

    var webApplicationDeploymentPath = (virtualApplication) ? webAppName + "/" + virtualApplication : webAppName;
    
    if(isFolderBasedDeployment) {
        msDeployCmdArgs += " -source:IisApp=\"" + webAppPackage + "\"";
        msDeployCmdArgs += " -dest:iisApp=\"" + webApplicationDeploymentPath + "\",";
    }
    else {       
        msDeployCmdArgs += " -source:package=\"" + webAppPackage + "\"";

        if(isParamFilePresentInPacakge) {
            msDeployCmdArgs += " -dest:auto,";
        }
        else {
            msDeployCmdArgs += " -dest:contentPath=\"" + webApplicationDeploymentPath + "\",";
        }
    }

    msDeployCmdArgs += "ComputerName='https://" + publishingProfile.publishUrl + "/msdeploy.axd?site=" + webAppName + "',";
    msDeployCmdArgs += "UserName='" + publishingProfile.userName + "',Password='" + publishingProfile.userPWD + "',AuthType='Basic'";

    if(isParamFilePresentInPacakge) {
        msDeployCmdArgs += " -setParam:name='IIS Web Application Name',value='" + webApplicationDeploymentPath + "'";
    }

    if(setParametersFile) {
        msDeployCmdArgs += " -setParamFile=\"" + setParametersFile + "\"";
    }

    if(!removeAdditionalFilesFlag) {
        msDeployCmdArgs += " -enableRule:DoNotDeleteRule";
    }

    if(takeAppOfflineFlag) {
        msDeployCmdArgs += ' -enableRule:AppOffline';
    }

    if(excludeFilesFromAppDataFlag) {
        msDeployCmdArgs += ' -skip:Directory=App_Data';
    }
    
    if(additionalArguments) {
        msDeployCmdArgs += ' ' + additionalArguments;
    }

    var userAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");
    if(userAgent) {
        msDeployCmdArgs += ' -userAgent:' + userAgent;
    }
    tl.debug(tl.loc('ConstructedmsDeploycomamndlinearguments'));
    return msDeployCmdArgs;
}

/**
 * Check whether the package contains parameter.xml file
 * @param   webAppPackage   web deploy package
 * @returns boolean
 */
export async  function containsParamFile(webAppPackage: string ) {
    var msDeployPath = await getMSDeployFullPath();
    var msDeployCheckParamFileCmdArgs = "-verb:getParameters -source:package=\"" + webAppPackage + "\"";
    
    var msDeployParamFile = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'msDeployParam.bat';
    var parameterFile = tl.getVariable('System.DefaultWorkingDirectory') + '\\' + 'parameter.xml';
    
    var silentCommand = '@echo off \n';
    var msDeployCommand = '"' + msDeployPath + '" ' + msDeployCheckParamFileCmdArgs + " > \"" + parameterFile + "\"";
    var batchCommand = silentCommand + msDeployCommand;

    tl.writeFile(msDeployParamFile, batchCommand);
    tl._writeLine(tl.loc("Runningcommand", msDeployCommand));

    var taskResult = tl.execSync("cmd", ['/C', msDeployParamFile], { failOnStdErr: true, silent: true });
    var paramContentXML = fs.readFileSync(parameterFile);
    var isParamFilePresent = false;
    await parseString(paramContentXML, (error, result) => {
        if(error) {
            throw new Error(error);
        }
        if(result['output']['parameters'][0] ) {
            isParamFilePresent = true;
        }
    });
    tl.debug(tl.loc("Isparameterfilepresentinwebpackage0", isParamFilePresent));
    return isParamFilePresent;
}

/**
 * Gets the full path of MSDeploy.exe
 * 
 * @returns    string
 */
export async function getMSDeployFullPath() {
    try {
        var msDeployInstallPathRegKey = "\\SOFTWARE\\Microsoft\\IIS Extensions\\MSDeploy";
        var msDeployLatestPathRegKey = await getMSDeployLatestRegKey(msDeployInstallPathRegKey);
        var msDeployFullPath = await getMSDeployInstallPath(msDeployLatestPathRegKey);
        msDeployFullPath = msDeployFullPath + "msdeploy.exe";
        return msDeployFullPath;
    }
    catch(error) {
        tl.warning(error);
        return __dirname + "\\MSDeploy3.6\\msdeploy.exe";
    }
}

function getMSDeployLatestRegKey(registryKey: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    var regKey = new winreg({
      hive: winreg.HKLM,
      key:  registryKey
    })

    regKey.keys(function(err, subRegKeys) {
        if(err) {
            defer.reject(tl.loc("UnabletofindthelocationofMSDeployfromregistryonmachineError", err));
        }
        var latestKeyVersion = 0 ;
        var latestSubKey;
        for(var index in subRegKeys) {
            var subRegKey = subRegKeys[index].key;
            var subKeyVersion = subRegKey.substr(subRegKey.lastIndexOf('\\')+1, subRegKey.length-1);
            if(!isNaN(subKeyVersion)){
                var subKeyVersionNumber = parseFloat(subKeyVersion);
                if(subKeyVersionNumber > latestKeyVersion) {
                    latestKeyVersion = subKeyVersionNumber;
                    latestSubKey = subRegKey;
                }
            }
        }
        if(latestKeyVersion < 3) {
            defer.reject(tl.loc("UnsupportedinstalledversionfoundforMSDeployversionshouldbealteast3orabove", latestKeyVersion));
        }
         defer.resolve(latestSubKey);
    });
    return defer.promise;
}

function getMSDeployInstallPath(registryKey: string): Q.Promise<string> {
    var defer = Q.defer<string>();

    var regKey = new winreg({
      hive: winreg.HKLM,
      key:  registryKey
    })

    regKey.get("InstallPath", function(err,item) {
        if(err) {
            defer.reject(tl.loc("UnabletofindthelocationofMSDeployfromregistryonmachineError", err));
        }
        defer.resolve(item.value);
    });

    return defer.promise;
}