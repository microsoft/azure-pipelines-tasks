/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import Q = require('q');
import tl = require('vsts-task-lib/task');

var regedit = require('regedit');
var azureRmUtil = require('./AzureRMUtil.js');

export function fileExists(path) {
  try  {
    return tl.stats(path).isFile();
  }
  catch (e) {
    if (e.code == 'ENOENT') {
      return false;
    }
    tl.debug("Exception tl.stats (" + path + "): " + e);
    throw e;
  }
}

export function getMSDeployCmdArgs(packageFile: string, webAppNameForMSDeployCmd: string, publishingProfile,
                             removeAdditionalFilesFlag: boolean, excludeFilesFromAppDataFlag: boolean, takeAppOfflineFlag: boolean,
                             virtualApplication: string, setParametersFile: string, additionalArguments: string) : string {

    var msDeployCmdArgs = ' -verb:sync';
    msDeployCmdArgs += ' -source:package=\'' + packageFile + '\'';
    msDeployCmdArgs += ' -dest:auto,ComputerName=https://' + publishingProfile.publishUrl + '/msdeploy.axd?site=' + webAppNameForMSDeployCmd + ',';
    msDeployCmdArgs += 'userName=' + publishingProfile.userName + ',Password=' + publishingProfile.userPWD + ',AuthType=Basic';

    if (setParametersFile) {
        msDeployCmdArgs += ' -setParamFile=' + setParametersFile;
    }
    
    if (virtualApplication) {
        msDeployCmdArgs += ' -setParam:name=\'IIS Web Application Name\',value=\'' + webAppNameForMSDeployCmd + '/' + virtualApplication + '\'';
    }
    else {
        msDeployCmdArgs += ' -setParam:name=\'IIS Web Application Name\',value=\'' + webAppNameForMSDeployCmd + '\'';
    }

    if (!removeAdditionalFilesFlag) {
        msDeployCmdArgs += ' -enableRule:DoNotDeleteRule';
    }

    if (takeAppOfflineFlag) {
        msDeployCmdArgs += ' -enableRule:AppOffline';
    }

    if (excludeFilesFromAppDataFlag) {
        msDeployCmdArgs += ' -skip:Directory=App_Data';
    }
    
    if (additionalArguments) {
        msDeployCmdArgs += ' ' + additionalArguments;
    }

    var userAgent = tl.getVariable("AZURE_HTTP_USER_AGENT");
    if (userAgent) {
        msDeployCmdArgs += ' -userAgent:' + userAgent;
    }
    tl.debug(tl.loc('ConstructedmsDeploycomamndlinearguments'));
    return msDeployCmdArgs;
}

export async function executeMSDeployCmd(msDeployCmdArgs: string, publishingProfile, webAppUri: string) {
    try {
        if(webAppUri) {
            tl.setVariable(webAppUri, publishingProfile.destinationAppUrl);
        }
        var msDeployPath = await getMSDeployFullPath();
            var statusCode = await tl.exec(msDeployPath, msDeployCmdArgs, <any> {failOnStdErr: true});
            if ( statusCode === 0 ) {
                tl.debug(tl.loc('WebappsuccessfullypublishedatUrl0',publishingProfile.destinationAppUrl));                
                var deploymentResult = await azureRmUtil.updateDeploymentStatus(publishingProfile, true);
                tl.debug(deploymentResult);
            }
            else {
                tl.debug(tl.loc('Failedtodeploywebsite'));
                var deploymentResult = await azureRmUtil.updateDeploymentStatus(publishingProfile, false);
                tl.debug(deploymentResult);
                onError(tl.loc('Failedtodeploywebsite'));
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