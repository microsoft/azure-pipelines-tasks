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
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var deployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag');
        var resourceGroupName: string = tl.getInput('ResourceGroupName');
        var slotName: string = tl.getInput('SlotName');
        var webDeployPkg: string = tl.getPathInput('Package', true);
        var virtualApplication: string = tl.getInput('VirtualApplication', false);

        var useWebDeploy: boolean = tl.getBoolInput('UseWebDeploy', false);
        var setParametersFile: string = (useWebDeploy !== undefined) ? tl.getPathInput('SetParametersFile1', false) : tl.getPathInput('SetParametersFile', false);
        var removeAdditionalFilesFlag: boolean = (useWebDeploy !== undefined) ? tl.getBoolInput('RemoveAdditionalFilesFlag1', false) : tl.getBoolInput('RemoveAdditionalFilesFlag', false);
        var excludeFilesFromAppDataFlag: boolean = (useWebDeploy !== undefined) ? tl.getBoolInput('ExcludeFilesFromAppDataFlag1', false) : tl.getBoolInput('ExcludeFilesFromAppDataFlag', false);
        var takeAppOfflineFlag: boolean = (useWebDeploy !== undefined) ? tl.getBoolInput('TakeAppOfflineFlag1', false) : tl.getBoolInput('TakeAppOfflineFlag', false);
        var additionalArguments: string = (useWebDeploy !== undefined) ? tl.getInput('AdditionalArguments1', false) : tl.getInput('AdditionalArguments', false);

        var webAppUri:string = tl.getInput('WebAppUri', false);
        var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);

        var SPN = new Array();
        SPN["servicePrincipalClientID"] = endPointAuthCreds.parameters["serviceprincipalid"];
        SPN["servicePrincipalKey"] = endPointAuthCreds.parameters["serviceprincipalkey"];
        SPN["tenantID"] = endPointAuthCreds.parameters["tenantid"];
        SPN["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true); 
        
        if (!tl.exist(webDeployPkg)) {
            throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', webDeployPkg));
        }
      
        var publishingProfile = await azureRmUtil.getAzureRMWebAppPublishProfile(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
        tl.debug(tl.loc('GotconnectiondetailsforazureRMWebApp0', webAppName));
        tl._writeLine("##vso[task.setvariable variable=$websitePassword;issecret=true;]" + publishingProfile.userPWD);

        if(virtualApplication) {
            publishingProfile.destinationAppUrl += "/" + virtualApplication;
        }
        if(webAppUri) {
            tl.setVariable(webAppUri, publishingProfile.destinationAppUrl);
        }

        if(useWebDeploy) {
            await DeployUsingMSDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
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
async function DeployUsingMSDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
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
        throw Error(tl.loc('SetParamFilenotfound0', setParametersFile));
    }

    var msDeployPath = await msDeployUtility.getMSDeployFullPath();
    var msDeployCmdArgs = msDeployUtility.getMSDeployCmdArgs(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
        excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile, additionalArguments, isParamFilePresentInPacakge, isFolderBasedDeployment);

    var isDeploymentSuccess = true;
    var deploymentError = null;
    try {
        await tl.exec(msDeployPath, msDeployCmdArgs, <any> {failOnStdErr: true});
        tl.debug(tl.loc('WebappsuccessfullypublishedatUrl0', publishingProfile.destinationAppUrl));
    }
    catch(error) {
        tl.error(tl.loc('Failedtodeploywebsite'));
        isDeploymentSuccess = false;
        deploymentError = error;
    }

    try {
        tl.debug(await azureRmUtil.updateDeploymentStatus(publishingProfile, isDeploymentSuccess));
    }
    catch(error) {
        tl.warning(error);
    }
    finally {
        if(!isDeploymentSuccess) {
            throw Error(deploymentError);
        }
    }
}

run();