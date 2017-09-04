import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as ParameterParser from './parameterparser'

var azureRESTUtility = require('azurerest-common/azurerestutility.js');
var msDeployUtility = require('webdeployment-common/msdeployutility.js');
var zipUtility = require('webdeployment-common/ziputility.js');
var deployUtility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
var fileTransformationsUtility = require('webdeployment-common/fileTransformationsUtility.js');
var kuduUtility = require('./kuduutility.js');
var generateWebConfigUtil = require('webdeployment-common/webconfigutil.js');
var deployWebAppImage = require("./azurermwebappcontainerdeployment").deployWebAppImage;
var updateAppSettings = require("./azurermwebappcontainerdeployment").updateAppSettings;
var azureStackUtility = require('azurestack-common/azurestackrestutility.js');
var parameterParser = require("./parameterparser.js").parse;

async function run() {
    try {

        tl.setResourcePath(path.join(__dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var webAppName: string = tl.getInput('WebAppName', true);
        var webAppKind = tl.getInput('WebAppKind', false);
        var webAppKindUserInput = tl.getInput('WebAppKindUserInput', false);
        var deployToSlotFlag: boolean = tl.getBoolInput('DeployToSlotFlag', false);
        var resourceGroupName: string = tl.getInput('ResourceGroupName', false);
        var slotName: string = tl.getInput('SlotName', false);
        var linuxImageSource = tl.getInput('LinuxImageSource', false);
        var dockerNamespace = tl.getInput('DockerNamespace', false);
        var virtualApplication: string = tl.getInput('VirtualApplication', false);
        var webDeployPkg: string = tl.getPathInput('Package', true);
        var webDeployPkgLinux: string = tl.getPathInput('PackageForBuiltInLinux', true);
        var webDeployPkgLinuxUserInput: string = tl.getPathInput('PackageForBuiltInLinuxUserInput', true);
        var webAppUri: string = tl.getInput('WebAppUri', false);
        var scriptType: string = tl.getInput('ScriptType', false);
        var inlineScript: string = tl.getInput('InlineScript', false);
        var scriptPath: string = tl.getPathInput('ScriptPath', false);
        var scriptTypeLinux: string = tl.getInput('ScriptTypeForBuiltInLinux', false);
        var inlineScriptLinux: string = tl.getInput('InlineScriptForBuiltInLinux', false);
        var scriptPathLinux: string = tl.getPathInput('ScriptPathForBuiltInLinux', false);
        var scriptTypeLinuxUserInput: string = tl.getInput('ScriptTypeForBuiltInLinuxUserInput', false);
        var inlineScriptLinuxUserInput: string = tl.getInput('InlineScriptForBuiltInLinuxUserInput', false);
        var scriptPathLinuxUserInput: string = tl.getPathInput('ScriptPathForBuiltInLinuxUserInput', false);
        var generateWebConfigForWebApp = tl.getBoolInput('GenerateWebConfig', false);
        var webConfigParametersStrForWebApp = tl.getInput('WebConfigParameters', false);
        var takeAppOfflineFlag: boolean = tl.getBoolInput('TakeAppOfflineFlag', false);
        var useWebDeploy: boolean = tl.getBoolInput('UseWebDeploy', false);
        var setParametersFile: string = tl.getPathInput('SetParametersFile', false);
        var removeAdditionalFilesFlag: boolean = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
        var excludeFilesFromAppDataFlag: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false);
        var additionalArguments: string = tl.getInput('AdditionalArguments', false);
        var renameFilesFlag: boolean = tl.getBoolInput('RenameFilesFlag', false);
        var useWebDeployLinux: boolean = tl.getBoolInput('UseWebDeployForBuiltInLinux', false);
        var setParametersFileLinux: string = tl.getPathInput('SetParametersFileForBuiltInLinux', false);
        var removeAdditionalFilesFlagLinux: boolean = tl.getBoolInput('RemoveAdditionalFilesFlagForBuiltInLinux', false);
        var excludeFilesFromAppDataFlagLinux: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlagForBuiltInLinux', false);
        var additionalArgumentsLinux: string = tl.getInput('AdditionalArgumentsForBuiltInLinux', false);
        var renameFilesFlagLinux: boolean = tl.getBoolInput('RenameFilesFlagForBuiltInLinux', false);
        var useWebDeployLinuxUserInput: boolean = tl.getBoolInput('UseWebDeployForBuiltInLinuxUserInput', false);
        var setParametersFileLinuxUserInput: string = tl.getPathInput('SetParametersFileForBuiltInLinuxUserInput', false);
        var removeAdditionalFilesFlagLinuxUserInput: boolean = tl.getBoolInput('RemoveAdditionalFilesFlagForBuiltInLinuxUserInput', false);
        var excludeFilesFromAppDataFlagLinuxUserInput: boolean = tl.getBoolInput('ExcludeFilesFromAppDataFlagForBuiltInLinuxUserInput', false);
        var additionalArgumentsLinuxUserInput: string = tl.getInput('AdditionalArgumentsForBuiltInLinuxUserInput', false);
        var renameFilesFlagLinuxUserInput: boolean = tl.getBoolInput('RenameFilesFlagForBuiltInLinuxUserInput', false);
        var useWebDeployForFunctionApp: boolean = tl.getBoolInput('UseWebDeployForFunctionApp', false);
        var setParametersFileForFunctionApp: string = tl.getPathInput('SetParametersFileForFunctionApp', false);
        var removeAdditionalFilesFlagForFunctionApp: boolean = tl.getBoolInput('RemoveAdditionalFilesFlagForFunctionApp', false);
        var additionalArgumentsForFunctionApp: string = tl.getInput('AdditionalArgumentsForFunctionApp', false);
        var renameFilesFlagForFunctionApp: boolean = tl.getBoolInput('RenameFilesFlagForFunctionApp', false);
        var xmlTransformationForWebApp: boolean = tl.getBoolInput('XmlTransformation', false);
        var xmlVariableSubstitutionForWebApp: boolean = tl.getBoolInput('XmlVariableSubstitution', false);
        var JSONFilesForWebApp = tl.getDelimitedInput('JSONFilesForWebApp', '\n', false);
        var JSONFiles = tl.getDelimitedInput('JSONFiles', '\n', false);
        var startupCommand = tl.getInput("StartupCommand", false);
        var inputappSettings = tl.getInput('AppSettings', false);
        var isAppKindUserInput = webAppKind != "" && webAppKind != "app" && webAppKind != "functionapp" && webAppKind != "applinux" && webAppKind != "api" && webAppKind != "mobileapp";

        webAppKind = isAppKindUserInput ? webAppKindUserInput : webAppKind;
        // Using applinuxbuiltin as the app type for linux apps with built-in images
        webAppKind = webAppKind === "applinux" && linuxImageSource != "DOCKER" ? "applinuxbuiltin" : webAppKind;

        var isLikeWebApp = webAppKind === "app" || webAppKind === "api" || webAppKind === "mobileapp";

        /**
         * Handling if the app kind is applinuxbuiltin
         * None of these inputs are valid for applinux(container) type
         */
        if (isAppKindUserInput && webAppKind === "applinuxbuiltin") {
            webDeployPkgLinux = webDeployPkgLinuxUserInput;

            scriptTypeLinux = scriptPathLinuxUserInput;
            inlineScriptLinux = inlineScriptLinuxUserInput;
            scriptPathLinux = scriptPathLinuxUserInput;

            useWebDeployLinux = useWebDeployLinuxUserInput;
            setParametersFileLinux = setParametersFileLinuxUserInput;
            removeAdditionalFilesFlagLinux = removeAdditionalFilesFlagLinuxUserInput;
            excludeFilesFromAppDataFlagLinux = excludeFilesFromAppDataFlagLinuxUserInput;
            additionalArgumentsLinux = additionalArgumentsLinuxUserInput;
            renameFilesFlagLinux = renameFilesFlagLinuxUserInput;
        }

        /**
         * final values of inputs
         */
        webDeployPkg = webAppKind === "applinuxbuiltin" ? webDeployPkgLinux : webDeployPkg;

        var generateWebConfig = isLikeWebApp ? generateWebConfigForWebApp : false;
        var webConfigParametersStr = isLikeWebApp ? webConfigParametersStrForWebApp : "";
        var xmlTransformation: boolean = isLikeWebApp ? xmlTransformationForWebApp : false;
        var xmlVariableSubstitution: boolean = isLikeWebApp ? xmlVariableSubstitutionForWebApp : false;
        JSONFiles = isLikeWebApp ? JSONFilesForWebApp : JSONFiles;

        scriptType = webAppKind === "applinuxbuiltin" ? scriptTypeLinux : scriptType;
        inlineScript = webAppKind === "applinuxbuiltin" ? inlineScriptLinux : inlineScript;
        scriptPath = webAppKind === "applinuxbuiltin" ? scriptPathLinux : scriptPath;

        if (webAppKind === "applinuxbuiltin") {
            useWebDeploy = useWebDeployLinux;
            setParametersFile = setParametersFileLinux;
            removeAdditionalFilesFlag = removeAdditionalFilesFlagLinux;
            excludeFilesFromAppDataFlag = excludeFilesFromAppDataFlagLinux;
            additionalArguments = additionalArgumentsLinux;
            renameFilesFlag = renameFilesFlagLinux;
        }
        else if (webAppKind === "functionapp") {
            useWebDeploy = useWebDeployForFunctionApp;
            setParametersFile = setParametersFileForFunctionApp;
            removeAdditionalFilesFlag = removeAdditionalFilesFlagForFunctionApp;
            additionalArguments = additionalArgumentsForFunctionApp;
            renameFilesFlag = renameFilesFlagForFunctionApp;
        }

        var isDeploymentSuccess: boolean = true;
        var tempPackagePath = null;

        var endPoint = await azureStackUtility.initializeAzureRMEndpointData(connectedServiceName);

        if (deployToSlotFlag) {
            if (slotName.toLowerCase() === "production") {
                deployToSlotFlag = false;
            }
        }
        else {
            resourceGroupName = await azureRESTUtility.getResourceGroupName(endPoint, webAppName);
        }

        var publishingProfile = await azureRESTUtility.getAzureRMWebAppPublishProfile(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', webAppName));

        // For container based linux deployment
        if (webAppKind && webAppKind.indexOf("linux") !== -1 && dockerNamespace) {
            tl.debug("Performing container based deployment.");

            await deployWebAppImage(endPoint, resourceGroupName, webAppName, deployToSlotFlag, slotName);
        }
        else {
            tl.debug("Performing the deployment of webapp.");

            var availableWebPackages = deployUtility.findfiles(webDeployPkg);
            if (availableWebPackages.length == 0) {
                throw new Error(tl.loc('Nopackagefoundwithspecifiedpattern'));
            }

            if (availableWebPackages.length > 1) {
                throw new Error(tl.loc('MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpattern'));
            }
            webDeployPkg = availableWebPackages[0];

            var azureWebAppDetails = null;
            var virtualApplicationPhysicalPath = null;
            if (virtualApplication) {
                virtualApplication = (virtualApplication.startsWith("/")) ? virtualApplication.substr(1) : virtualApplication;
                azureWebAppDetails = await azureRESTUtility.getAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
                var virtualApplicationMappings = azureWebAppDetails.properties.virtualApplications;
                var pathMappings = kuduUtility.getVirtualAndPhysicalPaths(virtualApplication, virtualApplicationMappings);
                if (pathMappings[1] != null) {
                    virtualApplicationPhysicalPath = pathMappings[1];
                    await kuduUtility.ensurePhysicalPathExists(publishingProfile, pathMappings[1]);
                }
                else {
                    throw Error(tl.loc("VirtualApplicationDoesNotExist", virtualApplication));
                }
            }
            var isFolderBasedDeployment = deployUtility.isInputPkgIsFolder(webDeployPkg);
            var applyFileTransformFlag = JSONFiles.length != 0 || xmlTransformation || xmlVariableSubstitution;

            if (applyFileTransformFlag || generateWebConfig) {
                var folderPath = await deployUtility.generateTemporaryFolderForDeployment(isFolderBasedDeployment, webDeployPkg);

                if (generateWebConfig) {
                    tl.debug('parsing web.config parameters');
                    var webConfigParameters = ParameterParser.parse(webConfigParametersStr);
                    generateWebConfigUtil.addWebConfigFile(folderPath, webConfigParameters, virtualApplicationPhysicalPath);
                }
                if (applyFileTransformFlag) {
                    var isMSBuildPackage = !isFolderBasedDeployment && (await deployUtility.isMSDeployPackage(webDeployPkg));
                    fileTransformationsUtility.fileTransformations(isFolderBasedDeployment, JSONFiles, xmlTransformation, xmlVariableSubstitution, folderPath, isMSBuildPackage);
                }

                var output = await deployUtility.archiveFolderForDeployment(isFolderBasedDeployment, folderPath);
                tempPackagePath = output.tempPackagePath;
                webDeployPkg = output.webDeployPkg;
            }

            if (virtualApplication) {
                publishingProfile.destinationAppUrl += "/" + virtualApplication;
            }

            if (webAppUri) {
                tl.setVariable(webAppUri, publishingProfile.destinationAppUrl);
            }

            if (publishingProfile && publishingProfile.destinationAppUrl) {
                try {
                    await azureRESTUtility.testAzureWebAppAvailability(publishingProfile.destinationAppUrl, 3000);
                } catch (error) {
                    tl.debug("Failed to check availability of azure web app, error : " + error.message);
                }
            }

            if (deployUtility.canUseWebDeploy(useWebDeploy) && webAppKind != "applinuxbuiltin") {
                if (!tl.osType().match(/^Win/)) {
                    throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
                }
                tl.debug("Using web deploy to deploy the web app");
                var appSettings = await azureRESTUtility.getWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
                if (renameFilesFlag) {
                    if (appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES == undefined || appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES == '0') {
                        appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES = '1';
                        await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, appSettings);
                    }
                }
                else {
                    if (appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES != undefined && appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES != '0') {
                        delete appSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES;
                        await azureRESTUtility.updateWebAppAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, appSettings);
                    }
                }
                console.log("##vso[task.setvariable variable=websiteUserName;issecret=true;]" + publishingProfile.userName);
                console.log("##vso[task.setvariable variable=websitePassword;issecret=true;]" + publishingProfile.userPWD);
                await msDeploy.DeployUsingMSDeploy(webDeployPkg, webAppName, publishingProfile, removeAdditionalFilesFlag,
                    excludeFilesFromAppDataFlag, takeAppOfflineFlag, virtualApplication, setParametersFile,
                    additionalArguments, isFolderBasedDeployment, useWebDeploy);
            } else {
                tl.debug("Initiated deployment via kudu service for webapp package : " + webDeployPkg);
                publishingProfile.publishUrl = webAppName + ".scm.azurewebsites.net:443";
                if (azureWebAppDetails == null) {
                    azureWebAppDetails = await azureRESTUtility.getAzureRMWebAppConfigDetails(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
                }
                if (webAppKind.indexOf("applinux") !== -1) {
                    tl.debug("Updating startup Command");
                    updateStartupCommandAndAppSettings(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName, startupCommand, inputappSettings);
                }
                await DeployUsingKuduDeploy(webDeployPkg, azureWebAppDetails, publishingProfile, virtualApplication, isFolderBasedDeployment, takeAppOfflineFlag);
            }
            if (scriptType) {
                var kuduWorkingDirectory = virtualApplication ? virtualApplicationPhysicalPath : 'site/wwwroot';
                await kuduUtility.runPostDeploymentScript(publishingProfile, kuduWorkingDirectory, scriptType, inlineScript, scriptPath, takeAppOfflineFlag);
            }
        }
        await updateWebAppConfigDetails(endPoint, webAppName, resourceGroupName, deployToSlotFlag, slotName);
    }
    catch (error) {
        isDeploymentSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    if (publishingProfile != null) {
        var customMessage = {
            type: "Deployment",
            slotName: (deployToSlotFlag ? slotName : "Production")
        };

        try {
            console.log(await azureRESTUtility.updateDeploymentStatus(publishingProfile, isDeploymentSuccess, customMessage));
        }
        catch (error) {
            tl.warning(error);
        }
    }
    if (tempPackagePath) {
        tl.rmRF(tempPackagePath);
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
    var tempPackagePath = null;
    try {
        var virtualApplicationMappings = azureWebAppDetails.properties.virtualApplications;
        var webAppZipFile = webDeployPkg;
        if (isFolderBasedDeployment) {
            tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('System.DefaultWorkingDirectory'), false);
            webAppZipFile = await zipUtility.archiveFolder(webDeployPkg, "", tempPackagePath);
            tl.debug("Compressed folder " + webDeployPkg + " into zip : " + webAppZipFile);
        } else {
            if (await deployUtility.isMSDeployPackage(webAppZipFile)) {
                throw new Error(tl.loc("MSDeploygeneratedpackageareonlysupportedforWindowsplatform"));
            }
        }
        var physicalPath = "/site/wwwroot";
        var virtualPath = "/";
        if (virtualApplication) {
            var pathMappings = kuduUtility.getVirtualAndPhysicalPaths(virtualApplication, virtualApplicationMappings);
            if (pathMappings[1] != null) {
                virtualPath = pathMappings[0];
                physicalPath = pathMappings[1];
            } else {
                throw Error(tl.loc("VirtualApplicationDoesNotExist", virtualApplication));
            }
        }
        await kuduUtility.deployWebAppPackage(webAppZipFile, publishingProfile, virtualPath, physicalPath, takeAppOfflineFlag);
        console.log(tl.loc('PackageDeploymentSuccess'));
    }
    catch (error) {
        tl.error(tl.loc('PackageDeploymentFailed'));
        throw Error(error);
    }
    finally {
        if (tempPackagePath) {
            tl.rmRF(tempPackagePath, true);
        }
    }
}

async function updateWebAppConfigDetails(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {
    try {
        var configDetails = await azureRESTUtility.getAzureRMWebAppConfigDetails(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
        var scmType: string = configDetails.properties.scmType;
        if (scmType && scmType.toLowerCase() === "none") {
            var updatedConfigDetails = JSON.stringify(
                {
                    "properties": {
                        "scmType": "VSTSRM"
                    }
                });
            await azureRESTUtility.updateAzureRMWebAppConfigDetails(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName, updatedConfigDetails);

            await updateArmMetadata(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);

            console.log(tl.loc("SuccessfullyUpdatedAzureRMWebAppConfigDetails"));
        }
    }
    catch (error) {
        tl.warning(tl.loc("FailedToUpdateAzureRMWebAppConfigDetails", error));
    }
}

async function updateArmMetadata(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string) {
    var collectionUri = tl.getVariable("system.teamfoundationCollectionUri");
    var projectId = tl.getVariable("system.teamprojectId");
    var buildDefintionId = tl.getVariable("build.definitionId")
    var releaseDefinitionId = tl.getVariable("release.definitionId");

    let newPoperties = {
        VSTSRM_BuildDefinitionId: buildDefintionId,
        VSTSRM_ReleaseDefinitionId: releaseDefinitionId,
        VSTSRM_ProjectId: projectId,
        VSTSRM_AccountId: tl.getVariable("system.collectionId"),
        VSTSRM_BuildDefinitionWebAccessUrl: collectionUri + projectId + "/_build?_a=simple-process&definitionId=" + buildDefintionId,
        VSTSRM_ConfiguredCDEndPoint: collectionUri + projectId + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?definitionId=" + releaseDefinitionId
    }

    var metadata = await azureRESTUtility.getAzureRMWebAppMetadata(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName);
    var properties = metadata.properties;

    Object.keys(newPoperties).forEach((key) => {
        properties[key] = newPoperties[key];
    });

    metadata.properties = properties;
    await azureRESTUtility.updateAzureRMWebAppMetadata(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName, metadata);
}

async function updateStartupCommandAndAppSettings(SPN, webAppName: string, resourceGroupName: string, deployToSlotFlag: boolean, slotName: string, startupCommand: string, appSettings: any) {
    try {
        tl.debug("Updating the startup Command");
        var updatedConfigDetails = JSON.stringify(
            {
                "properties": {
                    "appCommandLine": startupCommand
                }
            });
        await azureRESTUtility.updateAzureRMWebAppConfigDetails(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName, updatedConfigDetails);

        updateAppSettings(SPN, webAppName, resourceGroupName, deployToSlotFlag, slotName, appSettings);

        console.log(tl.loc("SuccessfullyUpdatedStartupCommandInConfigDetails"));
    }
    catch (error) {
        tl.warning(tl.loc("FailedToUpdateStartupCommandInConfigDetails", error));
    }
}
run();
