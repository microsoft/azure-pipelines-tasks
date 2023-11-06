import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import * as ParameterParser from './parameterparser'

import { TaskParameters, TaskParametersUtility } from './operations/TaskParameters';

import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from './operations/AzureAppServiceUtility';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { AzureResourceFilterUtility } from './operations/AzureResourceFilterUtility';
import { ContainerBasedDeploymentUtility } from './operations/ContainerBasedDeploymentUtility';
import { DeployWar } from './operations/WarDeploymentUtilities';
import { FileTransformsUtility } from './operations/FileTransformsUtility';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import { KuduServiceUtility } from './operations/KuduServiceUtility';
import { addReleaseAnnotation } from './operations/ReleaseAnnotationUtility';

import { PackageUtility } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { isInputPkgIsFolder, canUseWebDeploy } from 'azure-pipelines-tasks-webdeployment-common/utility';
import { DeployUsingMSDeploy } from 'azure-pipelines-tasks-webdeployment-common/deployusingmsdeploy';
import { shouldUseMSDeployTokenAuth, installedMSDeployVersionSupportsTokenAuth} from 'azure-pipelines-tasks-webdeployment-common/msdeployutility';

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
                    var webPackage = PackageUtility.getPackagePath(taskParams.Package);
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
            var webPackage = PackageUtility.getPackagePath(taskParams.Package);
            var isFolderBasedDeployment = isInputPkgIsFolder(webPackage);
            var physicalPath: string = '/site/wwwroot';
            if(taskParams.VirtualApplication) {
                physicalPath = await appServiceUtility.getPhysicalPath(taskParams.VirtualApplication);
                await kuduServiceUtility.createPathIfRequired(physicalPath);
                virtualApplicationPath = physicalPath;
            }

            webPackage = await FileTransformsUtility.applyTransformations(webPackage, taskParams);

            if(canUseWebDeploy(taskParams.UseWebDeploy)) {
                tl.debug("Performing the deployment of webapp.");
                if(tl.getPlatform() !== tl.Platform.Windows){
                    throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
                }

                if(taskParams.RenameFilesFlag) {
                    await appServiceUtility.enableRenameLockedFiles();
                }

                var msDeployPublishingProfile = await appServiceUtility.getWebDeployPublishingProfile();
                let authType = "Basic";

                if (await appServiceUtility.isSitePublishingCredentialsEnabled()) {
                    tl.debug("Using Basic authentication.")                        
                }
                else if (!shouldUseMSDeployTokenAuth()) {
                    //deployment would fail in this case
                    throw new Error(tl.loc("BasicAuthNotSupported"));
                }
                else if (await installedMSDeployVersionSupportsTokenAuth() === false) {
                    //deployment would fail in this case
                    throw new Error(tl.loc("MSDeployNotSupportTokenAuth"));
                }
                else {
                    tl.debug("Basic authentication is disabled, using token based authentication.");
                    authType = "Bearer";
                    msDeployPublishingProfile.userPWD = await appServiceUtility.getAuthToken();
                    msDeployPublishingProfile.userName = "user"; // arbitrary but not empty
                }

                if (webPackage.toString().toLowerCase().endsWith('.war')) {
                    await DeployWar(webPackage, taskParams, msDeployPublishingProfile, kuduService, appServiceUtility, authType);
                }
                else {
                    await DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
                    taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
                    taskParams.AdditionalArguments, isFolderBasedDeployment, taskParams.UseWebDeploy, authType);
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
