import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

var azureRESTUtility = require ('webdeployment-common/azurerestutility.js');
var zipUtility = require('webdeployment-common/ziputility.js');
var utility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
var jsonSubstitutionUtility = require('webdeployment-common/jsonvariablesubstitutionutility.js');
var xmlSubstitutionUtility = require('webdeployment-common/xmlvariablesubstitutionutility.js');
var xdtTransformationUtility = require('webdeployment-common/xdttransformationutility.js');
var kuduUtility = require('webdeployment-common/kuduutility.js');

async function run() {
    try {

        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var deployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag', false);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var slotName: string = tl.getInput('SlotName', false);
        var webDeployPkg: string = tl.getPathInput('Package', true);
        var virtualApplication: string = tl.getInput('VirtualApplication', false);
        var useWebDeploy: boolean = tl.getBoolInput('UseWebDeploy', false);
        var setParametersFile: string = tl.getPathInput('SetParametersFile', false);
        var removeAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
        var excludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false);
        var takeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag', false);
        var renameFilesFlag: boolean = tl.getBoolInput('RenameFilesFlag', false);
        var additionalArguments: string = tl.getInput('AdditionalArguments', false);
        var webAppUri:string = tl.getInput('WebAppUri', false);
        var xmlTransformation: boolean = tl.getBoolInput('XmlTransformation', false);
        var JSONFiles = tl.getDelimitedInput('JSONFiles', '\n', false);
        var xmlVariableSubstitution: boolean = tl.getBoolInput('XmlVariableSubstitution', false);
        var endPointAuthCreds = tl.getEndpointAuthorization(connectedServiceName, true);

        var isDeploymentSuccess: boolean = true;
        var deploymentErrorMessage: string;

        var endPoint = new Array();
        endPoint["servicePrincipalClientID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalid', true);
        endPoint["servicePrincipalKey"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'serviceprincipalkey', true);
        endPoint["tenantID"] = tl.getEndpointAuthorizationParameter(connectedServiceName, 'tenantid', true);
        endPoint["subscriptionId"] = tl.getEndpointDataParameter(connectedServiceName, 'subscriptionid', true);
        endPoint["url"] = tl.getEndpointUrl(connectedServiceName, true);

        if(!deployToSlotFlag) {
            resourceGroupName = await azureRESTUtility.getResourceGroupName(endPoint, webAppName);
        }

        var publishingProfile = await azureRESTUtility.getAzureRMWebAppPublishProfile(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
        tl._writeLine(tl.loc('GotconnectiondetailsforazureRMWebApp0', webAppName));

        var availableWebPackages = utility.findfiles(webDeployPkg);
        if(availableWebPackages.length == 0) {
            throw new Error(tl.loc('Nopackagefoundwithspecifiedpattern'));
        }

        if(availableWebPackages.length > 1) {
            throw new Error(tl.loc('MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpatern'));
        }
        webDeployPkg = availableWebPackages[0];

        var isFolderBasedDeployment = utility.isInputPkgIsFolder(webDeployPkg);

        if(JSONFiles.length != 0 || xmlTransformation || xmlVariableSubstitution) {

            var folderPath = path.join(tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_package_folder');
            if(isFolderBasedDeployment) {
                tl.cp(path.join(webDeployPkg, '/*'), folderPath, '-rf', false);
            }
            else {
                await zipUtility.unzip(webDeployPkg, folderPath);
            }

            if(xmlTransformation) {
                var environmentName = tl.getVariable('Release.EnvironmentName');
                if(tl.osType().match(/^Win/)) {
                    var transformConfigs = ["Release.config"];
                    if(environmentName) {
                        transformConfigs.push(environmentName + ".config");
                    }
                    xdtTransformationUtility.basicXdtTransformation(path.join(folderPath,'**', '*.config'), transformConfigs);  
                    tl._writeLine("XDT Transformations applied successfully");
                } else {
                    throw new Error(tl.loc("CannotPerformXdtTransformationOnNonWindowsPlatform"));
                }
            }

            if(xmlVariableSubstitution) {
                await xmlSubstitutionUtility.substituteAppSettingsVariables(folderPath);
            }

            if(JSONFiles.length != 0) {
                jsonSubstitutionUtility.jsonVariableSubstitution(folderPath, JSONFiles);
            }

            webDeployPkg = (isFolderBasedDeployment) ? folderPath : await zipUtility.archiveFolder(folderPath, tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_package.zip')
        }

        if(virtualApplication) {
            publishingProfile.destinationAppUrl += "/" + virtualApplication;
        }

        if(webAppUri) {
            tl.setVariable(webAppUri, publishingProfile.destinationAppUrl);
        }

        if(utility.canUseWebDeploy(useWebDeploy)) {
            if(!tl.osType().match(/^Win/)){
                throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
            }

            var appSettings = await azureRESTUtility.getWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
            if(renameFilesFlag){
                if(appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES == undefined || appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES == '0'){
                    appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES = '1';
                    await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, appSettings);
                }
            }
            else if(!renameFilesFlag){
                if(appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES != undefined && appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES != '0'){
                    delete appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES;
                    await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, appSettings);
                }
            }
            tl._writeLine("##vso[task.setvariable variable=websiteUserName;issecret=true;]" + publishingProfile.userName);
            tl._writeLine("##vso[task.setvariable variable=websitePassword;issecret=true;]" + publishingProfile.userPWD);
            await msDeploy.DeployUsingMSDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
                            excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile,
                            additionalArguments, isFolderBasedDeployment, useWebDeploy);
        } else {
            tl.debug(tl.loc("Initiateddeploymentviakuduserviceforwebapppackage", webDeployPkg));
            var azureWebAppDetails = await azureRESTUtility.getAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
            await DeployUsingKuduDeploy(webDeployPkg, azureWebAppDetails, publishingProfile, virtualApplication, isFolderBasedDeployment, takeAppOfflineFlag);

        }
        
    } catch (error) {
        isDeploymentSuccess = false;
        deploymentErrorMessage = error;
    }
    if(publishingProfile != null) {
        try {
            tl._writeLine(await azureRESTUtility.updateDeploymentStatus(publishingProfile, isDeploymentSuccess));
        }
        catch(error) {
            tl.warning(error);
        }
    }
    if(!isDeploymentSuccess) {
        tl.setResult(tl.TaskResult.Failed, deploymentErrorMessage);
    }
}


/**
 * Deploys website using Kudu REST API
 * 
 * @param   webDeployPkg                   Web deploy package
 * @param   webAppName                     Web App Name
 * @param   publishingProfile              Azure RM Connection Details
 * @param   virtualApplication             Virtual Application Name
 * @param   isFolderBasedDeployment        Input is folder or not
 *
 */
async function DeployUsingKuduDeploy(webDeployPkg, azureWebAppDetails, publishingProfile, virtualApplication, isFolderBasedDeployment, takeAppOfflineFlag) {

    try {
        var virtualApplicationMappings = azureWebAppDetails.properties.virtualApplications;
        var webAppZipFile = webDeployPkg;
        if(isFolderBasedDeployment) {
            webAppZipFile = await zipUtility.archiveFolder(webDeployPkg, tl.getVariable('System.DefaultWorkingDirectory'), 'temp_web_app_package.zip');
            tl.debug(tl.loc("Compressedfolderintozip", webDeployPkg, webAppZipFile));
        } else {
            if (await kuduUtility.containsParamFile(webAppZipFile)) {
                throw new Error(tl.loc("MSDeploygeneratedpackageareonlysupportedforWindowsplatform")); 
            }
        }
        var pathMappings = kuduUtility.getVirtualAndPhysicalPaths(virtualApplication, virtualApplicationMappings);
        await kuduUtility.deployWebAppPackage(webAppZipFile, publishingProfile, pathMappings[0], pathMappings[1], takeAppOfflineFlag);
        tl._writeLine(tl.loc('WebappsuccessfullypublishedatUrl0', publishingProfile.destinationAppUrl));
    }
    catch(error) {
        tl.error(tl.loc('Failedtodeploywebsite'));
        throw Error(error);
    }
}

run();
