import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');

import * as ParameterParser from './parameterparser'

import { TaskParameters, TaskParametersUtility } from './operations/TaskParameters';

import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service';
import { AzureAppServiceUtility } from './operations/AzureAppServiceUtility';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureResourceFilterUtility } from './operations/AzureResourceFilterUtility';
import { ContainerBasedDeploymentUtility } from './operations/ContainerBasedDeploymentUtility';
import { DeployWar } from './operations/WarDeploymentUtilities';
import { FileTransformsUtility } from './operations/FileTransformsUtility';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu';
import { KuduServiceUtility } from './operations/KuduServiceUtility';
import { addReleaseAnnotation } from './operations/ReleaseAnnotationUtility';

var packageUtility = require('./webdeployment-common/packageUtility.js');

var deployUtility = require('./webdeployment-common/utility.js');
var msDeploy = require('./webdeployment-common/deployusingmsdeploy.js');

async function main() {
    let zipDeploymentID: string;
    let isDeploymentSuccess: boolean = true;
    let kuduServiceUtility: KuduServiceUtility;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(taskParams.connectedServiceName).getEndpoint();
        var virtualApplicationPath: string;
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParams.WebAppName));
        
        if (taskParams.WebAppKind.includes("functionapp")){
            tl.warning(`Recommendation: Use Azure Functions Task to deploy Function app.`);
        }

        if(!taskParams.DeployToSlotFlag) {
            taskParams.ResourceGroupName = await AzureResourceFilterUtility.getResourceGroupName(azureEndpoint, taskParams.WebAppName);
        }

        tl.debug(`Resource Group: ${taskParams.ResourceGroupName}`);
        var appService: AzureAppService = new AzureAppService(azureEndpoint, taskParams.ResourceGroupName, taskParams.WebAppName, taskParams.SlotName, taskParams.WebAppKind);
        let appServiceUtility: AzureAppServiceUtility = new AzureAppServiceUtility(appService);

        await appServiceUtility.pingApplication();
        let kuduService: Kudu = await appServiceUtility.getKuduService();
        kuduServiceUtility = new KuduServiceUtility(kuduService);
        if(taskParams.WebAppUri) {
            tl.setVariable(taskParams.WebAppUri, await appServiceUtility.getApplicationURL(!taskParams.isLinuxApp ? taskParams.VirtualApplication : null));
        }

        if(taskParams.isLinuxApp) {
            switch(taskParams.ImageSource) {
                case 'Builtin': {
                    var webPackage = packageUtility.PackageUtility.getPackagePath(taskParams.Package);
                    tl.debug('Performing Linux built-in package deployment');
                    zipDeploymentID = await kuduServiceUtility.zipDeploy(webPackage, taskParams.TakeAppOfflineFlag, { slotName: appService.getSlot() });
                    await appServiceUtility.updateStartupCommandAndRuntimeStack(taskParams.RuntimeStack, taskParams.StartupCommand);
                    break;
                }
                case 'Registry': {
                    tl.debug("Performing container based deployment.");
                    let containerDeploymentUtility: ContainerBasedDeploymentUtility = new ContainerBasedDeploymentUtility(appService);
                    await containerDeploymentUtility.deployWebAppImage(taskParams);
                    break;
                }
                default: {
                    throw new Error('Invalid Image source Type');
                }
            }
        }
        else {
            var webPackage = packageUtility.PackageUtility.getPackagePath(taskParams.Package);
            var isFolderBasedDeployment = deployUtility.isInputPkgIsFolder(webPackage);
            var physicalPath: string = '/site/wwwroot';
            if(taskParams.VirtualApplication) {
                physicalPath = await appServiceUtility.getPhysicalPath(taskParams.VirtualApplication);
                await kuduServiceUtility.createPathIfRequired(physicalPath);
                virtualApplicationPath = physicalPath;
            }

            webPackage = await FileTransformsUtility.applyTransformations(webPackage, taskParams);

            if(deployUtility.canUseWebDeploy(taskParams.UseWebDeploy)) {
                tl.debug("Performing the deployment of webapp.");
                if(!tl.osType().match(/^Win/)){
                    throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
                }

                if(taskParams.RenameFilesFlag) {
                    await appServiceUtility.enableRenameLockedFiles();
                }

                var msDeployPublishingProfile = await appServiceUtility.getWebDeployPublishingProfile();
                if (webPackage.toString().toLowerCase().endsWith('.war')) {
                    await DeployWar(webPackage, taskParams, msDeployPublishingProfile, kuduService, appServiceUtility);
                }
                else {
                    await msDeploy.DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
                    taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
                    taskParams.AdditionalArguments, isFolderBasedDeployment, taskParams.UseWebDeploy);
                }
            }
            else {
                tl.debug("Initiated deployment via kudu service for webapp package : ");
                await kuduServiceUtility.deployWebPackage(webPackage, physicalPath, taskParams.VirtualApplication, taskParams.TakeAppOfflineFlag);
            }
        }

        if(!taskParams.isContainerWebApp) {
            if(taskParams.AppSettings) {
                var customApplicationSettings = ParameterParser.parse(taskParams.AppSettings);
                await appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
            }

            if(taskParams.ConfigurationSettings) {
                var customApplicationSettings = ParameterParser.parse(taskParams.ConfigurationSettings);
                await appServiceUtility.updateConfigurationSettings(customApplicationSettings);
            }
        }
        else {
            tl.debug('App Settings and config settings are already updated during container based deployment.')
        }

        if(taskParams.ScriptType) {
            await kuduServiceUtility.runPostDeploymentScript(taskParams, virtualApplicationPath);
        }

        await appServiceUtility.updateScmTypeAndConfigurationDetails();
    }
    catch(error) {
        isDeploymentSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        if(kuduServiceUtility) {
            await addReleaseAnnotation(azureEndpoint, appService, isDeploymentSuccess);
            let activeDeploymentID: string = await kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: appService.getSlot()});
            if(zipDeploymentID && activeDeploymentID && isDeploymentSuccess) {
                await kuduServiceUtility.postZipDeployOperation(zipDeploymentID, activeDeploymentID);
            }
        }
        else {
            tl.debug('Cannot update deployment status as Kudu is not initialized');
        }
    }
}

main();
