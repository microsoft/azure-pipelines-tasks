
/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');
import path = require('path');

var azureRmUtil = require ('./AzureRMUtil.js');
var msDeployUtility = require('./MSDeployUtility.js');

async function run() {
    try {

        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName');
        var webAppName: string = tl.getInput('WebAppName');
        var deployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag');
        var resourceGroupName: string = tl.getInput('ResourceGroupName');
        var slotName: string = tl.getInput('SlotName');
        var webDeployPkg: string = tl.getPathInput('Package');
        var setParametersFile: string = tl.getPathInput('SetParametersFile');
        var removeAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag');
        var excludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag');
        var takeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag');
        var virtualApplication: string = tl.getInput('VirtualApplication');
        var additionalArguments: string = tl.getInput('AdditionalArguments');
        var webAppUri:string = tl.getInput('WebAppUri');
        var useWebDeploy: boolean = tl.getBoolInput('UseWebDeploy');
        var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);

        var SPN = new Array();
        SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
        SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
        SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
        SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true); 
        
        if (!tl.exist(webDeployPkg)) {
            throw new Error(tl.loc('Packageorfoldernotfound0', webDeployPkg));
        }
      
        var publishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
        tl._writeLine("##vso[task.setvariable variable=$websitePassword;issecret=true;]"+publishingProfile.userPWD);

        if(webAppUri) {
            tl.setVariable(webAppUri, publishingProfile.destinationAppUrl);
        }

        if(useWebDeploy) {
            await executeWebDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
                            excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments);
        }
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}


/**
 * Executes Web Deploy command
 * 
 * @param   webDeployPkg                   Web deploy package
 * @param   webAppName                      web App Name
 * @param   publishingProfile               Azure RM Connection Details
 * @param   removeAdditionalFilesFlag       Flag to set DoNotDeleteRule rule
 * @param   excludeFilesFromAppDataFlag     Flag to prevent App Data from publishing
 * @param   takeAppOfflineFlag              Flag to enable AppOffline rule
 * @param   virtualApplication              Virtual Application Name
 * @param   setParametersFile               Set Parameter File path
 * @param   additionalArguments             Arguments provided by user
 * 
 */
async function executeWebDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments) {

    var isParamFilePresentInPacakge = false;
    var isFolderBasedDeployment = !msDeployUtility.fileExists(webDeployPkg);
    
    if (!isFolderBasedDeployment) {
        isParamFilePresentInPacakge = await msDeployUtility.containsParamFile(webDeployPkg);
    }

    if(!tl.filePathSupplied('SetParametersFile')) {
        setParametersFile = null;
    }
    else if (!msDeployUtility.fileExists(setParametersFile)) {
        throw new Error(tl.loc('SetParamFilenotfound0', setParametersFile));
    }

    var msDeployArgs = msDeployUtility.getMSDeployCmdArgs(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments, isParamFilePresentInPacakge, isFolderBasedDeployment);

    await msDeployUtility.executeMSDeployCmd(msDeployArgs, publishingProfile);
}

run();