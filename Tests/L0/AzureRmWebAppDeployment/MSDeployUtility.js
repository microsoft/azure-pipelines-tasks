/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
"use strict";

const tl = require('vsts-task-lib/task');
function fileExists(path) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        if (error.code == 'ENOENT') {
            return false;
        }
        tl.debug("Exception tl.stats (" + path + "): " + error);
        throw Error(error);
    }
}
exports.fileExists = fileExists;

function getMSDeployCmdArgs(webAppPackage, webAppName, publishingProfile, removeAdditionalFilesFlag, excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments, isParamFilePresentInPacakge, isFolderBasedDeployment) {
    var msDeployCmdArgs = " -verb:sync";
    var webApplicationDeploymentPath = (virtualApplication) ? webAppName + "/" + virtualApplication : webAppName;
    if (isFolderBasedDeployment) {
        msDeployCmdArgs += " -source:IisApp='" + webAppPackage + "'";
        msDeployCmdArgs += " -dest:iisApp='" + webApplicationDeploymentPath + "',";
    }
    else {
        msDeployCmdArgs += " -source:package='" + webAppPackage + "'";
        if (isParamFilePresentInPacakge) {
            msDeployCmdArgs += " -dest:auto,";
        }
        else {
            msDeployCmdArgs += " -dest:contentPath='" + webApplicationDeploymentPath + "',";
        }
    }
    msDeployCmdArgs += "ComputerName='https://" + publishingProfile.publishUrl + "/msdeploy.axd?site=" + webAppName + "',";
    msDeployCmdArgs += "UserName='" + publishingProfile.userName + "',Password='" + publishingProfile.userPWD + "',AuthType='Basic'";
    if (isParamFilePresentInPacakge || setParametersFile != null) {
        msDeployCmdArgs += " -setParam:name='IIS Web Application Name',value='" + webApplicationDeploymentPath + "'";
    }
    if (setParametersFile) {
        msDeployCmdArgs += " -setParamFile=" + setParametersFile;
    }
    if (!removeAdditionalFilesFlag) {
        msDeployCmdArgs += " -enableRule:DoNotDeleteRule";
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
exports.getMSDeployCmdArgs = getMSDeployCmdArgs;

function containsParamFile(webAppPackage) {
        var msDeployPath = getMSDeployFullPath();
        var msDeployCheckParamFileCmdArgs = "-verb:getParameters -source:package='" + webAppPackage + "'";
        var taskResult = tl.execSync(msDeployPath, msDeployCheckParamFileCmdArgs);
        var paramContentXML = taskResult.stdout;
        var isParamFilePresent = false;

        // Return mocked output
        return taskResult.code == 0 ? isParamFilePresent : true;
}
exports.containsParamFile = containsParamFile;

function getMSDeployFullPath() {
    var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
    return msDeployFullPath;
}
exports.getMSDeployFullPath = getMSDeployFullPath;
function onError(error) {
    tl.setResult(tl.TaskResult.Failed, error);
    process.exit(1);
}
