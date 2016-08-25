/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import tl = require('vsts-task-lib/task');
var fs = require('fs');
var regedit = require('regedit');
var azureRmUtil = require('./AzureRMUtil.js');

export function fileExists(path) {
  try  {
    return fs.statSync(path).isFile();
  }
  catch (e) {
    if (e.code == 'ENOENT') {
      return false;
    }
    tl.debug("Exception fs.statSync (" + path + "): " + e);
    throw e;
  }
}

export function getMSDeployCmdArgs(packageFile: string, webAppNameForMSDeployCmd: string, azureRMWebAppConnectionDetails: Array<String>,
                             removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean, takeAppOfflineFlag: boolean,
                             virtualApplication: string, setParametersFile: string, additionalArguments: string) : string {

    var msDeployCmdArgs = ' -verb:sync';
    msDeployCmdArgs += ' -source:package=\'' + packageFile + '\'';
    msDeployCmdArgs += ' -dest:auto,ComputerName="https://' + azureRMWebAppConnectionDetails["KuduHostName"] + '/msdeploy.axd?site=' + webAppNameForMSDeployCmd + '",';
    msDeployCmdArgs += 'UserName="' + azureRMWebAppConnectionDetails['UserName'] + '",Password="' + azureRMWebAppConnectionDetails['UserPassword'] + '",AuthType="Basic"';

    if (setParametersFile) {
        msDeployCmdArgs += ' -setParamFile=' + setParametersFile;
    }
    else if (virtualApplication) {
        msDeployCmdArgs += ' -setParam:name="IIS Web Application Name",value="' + webAppNameForMSDeployCmd + '/' + virtualApplication + '"';
    }
    else {
        msDeployCmdArgs += ' -setParam:name=\'IIS Web Application Name\',value="' + webAppNameForMSDeployCmd + '"';
    }

    if (!removeAdditionalFilesFlag) {
        msDeployCmdArgs += ' -enableRule:DoNotDeleteRule';
    }

    if (takeAppOfflineFlag) {
        msDeployCmdArgs += ' -enableRule:AppOffline';
    }

    if (excludeFilesFromAppDataFlag) {
        msDeployCmdArgs += ' -skip:Directory="\\App_Data"';
    }
    
    if (additionalArguments) {
        msDeployCmdArgs += ' ' + additionalArguments;
    }

    var userAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");
    if (userAgent) {
        msDeployCmdArgs += ' -userAgent:"' + userAgent + '"';
    }
    tl.debug(tl.loc('ConstructedmsDeploycomamndlinearguments'));
    return msDeployCmdArgs;
}

export async function executeMSDeployCmd(msDeployCmdArgs: string, azureRMWebAppConnectionDetails) {
    try {
        var msDeployPath = await getMSDeployFullPath();
        var maskedCommand = maskPasswordDetails(msDeployCmdArgs);
            tl.debug(tl.loc('Runningcommand01', msDeployPath, maskedCommand));
            var statusCode = await tl.exec(msDeployPath, msDeployCmdArgs, <any> {failOnStdErr: true});
            if ( statusCode === 0 ) {
                tl.debug(tl.loc('Successfullydeployedwebsite'));
                var deploymentResult = await azureRmUtil.updateDeploymentStatus(azureRMWebAppConnectionDetails, true);
                tl.debug(deploymentResult);
            }
            else {
                tl.debug(tl.loc('Failedtodeploywebsite'));
                var deploymentResult = await azureRmUtil.updateDeploymentStatus(azureRMWebAppConnectionDetails, false);
                tl.debug(deploymentResult);
            }
    }
    catch(error) {
       onError(error);
    }
}

async function getMSDeployFullPath() {
    try {
        var msDeployInstallPathRegKey = "HKLM\\SOFTWARE\\Microsoft\\IIS Extensions\\MSDeploy";
        var msDeployVersion = await getMSDeployVersion(msDeployInstallPathRegKey);
        var msDeployLatestPathRegKey = msDeployInstallPathRegKey + "\\" + msDeployVersion;
        var msDeployFullPath = await getMSDeployInstallPath(msDeployLatestPathRegKey);
        msDeployFullPath = msDeployFullPath + "\\msdeploy.exe";
        return msDeployFullPath;
    }
    catch(error) {
        tl.error(tl.loc('CannotfindMSDeployexe'));
        onError(error);
    }
}

function onError(error) {
    tl.setResult(tl.TaskResult.Failed, error);
    process.exit(1);
}

function maskPasswordDetails(msDeployCmdArgs: string): string {
    var startIndex = msDeployCmdArgs.indexOf('Password=');
    var endIndex = msDeployCmdArgs.indexOf(',AuthType=');
    msDeployCmdArgs = msDeployCmdArgs.replace(msDeployCmdArgs.substring(startIndex, endIndex), "Password=******");
    return msDeployCmdArgs;
}

function getMSDeployVersion(registryKey: string): Q.Promise<String> {
    var defer = Q.defer<String>();
    regedit.list(registryKey)
    .on('data', (entry) => {
        var keys = entry.data.keys;
        keys.sort();
        defer.resolve(keys[keys.length-1]);
    })
    .on('error', (error) => {
        defer.reject(error);
    });
    
    return defer.promise;
}

function getMSDeployInstallPath(registryKey: string): Q.Promise<string> {
    var defer = Q.defer<string>();
    regedit.list(registryKey)
    .on('data', (entry) => {
        defer.resolve(entry.data.values.InstallPath.value);
    })
    .on('error', (error) => {
        defer.reject(error);
    });

    return defer.promise;
}