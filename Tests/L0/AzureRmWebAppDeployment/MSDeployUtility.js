/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const Q = require('q');
const tl = require('vsts-task-lib/task');
var regedit = require('regedit');
var azureRmUtil = require('./AzureRMUtil.js');
var parseString = require('xml2js').parseString;
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
/**
 * Check whether the package contains parameter.xml file
 * @param   webAppPackage   web deploy package
 * @returns boolean
 */
function containsParamFile(webAppPackage) {
    return __awaiter(this, void 0, void 0, function* () {
        var msDeployPath = yield getMSDeployFullPath();
        var msDeployCheckParamFileCmdArgs = "-verb:getParameters -source:package='" + webAppPackage + "'";
        var taskResult = tl.execSync(msDeployPath, msDeployCheckParamFileCmdArgs);
        console.log ('**************** taskResult : ' + JSON.stringify(taskResult) );

        var paramContentXML = taskResult.stdout;
        tl.debug(tl.loc("Paramscontentofwebpackage0", paramContentXML));
        var isParamFilePresent = false;

        // Return mocked output
        return taskResult.code == 0 ? isParamFilePresent : true;

        yield parseString(paramContentXML, (error, result) => {
            if (error) {
                onError(error);
            }
            if (result['output']['parameters'][0]) {
                isParamFilePresent = true;
            }
        });
        tl.debug(tl.loc("Isparameterfilepresentinwebpackage0", isParamFilePresent));
        
        return isParamFilePresent;

    });
}
exports.containsParamFile = containsParamFile;
/**
 * Gets the full path of MSDeploy.exe
 *
 * @returns    string
 */
function getMSDeployFullPath() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            var msDeployFullPath =  "msdeploypath\\msdeploy.exe";
            return msDeployFullPath;
        }
        catch (error) {
            tl.error(tl.loc('CannotfindMSDeployexe'));
            onError(error);
        }
    });
}
exports.getMSDeployFullPath = getMSDeployFullPath;
function onError(error) {
    tl.setResult(tl.TaskResult.Failed, error);
    process.exit(1);
}
