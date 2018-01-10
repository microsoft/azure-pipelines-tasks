import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { AzureResourceFilterUtility } from './operations/AzureResourceFilterUtility';
import { KuduServiceUtility } from './operations/KuduServiceUtility';
import { AzureAppService } from 'azure-arm-rest/azure-arm-app-service';
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from './operations/AzureAppServiceUtility';
import { ContainerBasedDeploymentUtility } from './operations/ContainerBasedDeploymentUtility';
import { TaskParameters, TaskParametersUtility } from './operations/TaskParameters';
import { FileTransformsUtility } from './operations/FileTransformsUtility';
import * as ParameterParser from './parameterparser'
import { addReleaseAnnotation } from './operations/ReleaseAnnotationUtility';

var packageUtility = require('webdeployment-common/packageUtility.js');

var zipUtility = require('webdeployment-common/ziputility.js');
var deployUtility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');

async function main() {
    try {
        var isDeploymentSuccess: boolean = true;
        var kuduServiceUtility: KuduServiceUtility;
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(taskParams.connectedServiceName).getEndpoint();
        
        if(!taskParams.DeployToSlotFlag) {
            taskParams.ResourceGroupName = await AzureResourceFilterUtility.getResourceGroupName(azureEndpoint, 'Microsoft.Web/Sites', taskParams.WebAppName);
        }

        tl.debug(`Resource Group: ${taskParams.ResourceGroupName}`);
        var appService: AzureAppService = new AzureAppService(azureEndpoint, taskParams.ResourceGroupName, taskParams.WebAppName, taskParams.SlotName, taskParams.WebAppKind);
        let appServiceUtility: AzureAppServiceUtility = new AzureAppServiceUtility(appService);

        await appServiceUtility.pingApplication();
        let kuduService: Kudu = await appServiceUtility.getKuduService();
        kuduServiceUtility = new KuduServiceUtility(kuduService);
        if(taskParams.WebAppUri) {
            
            tl.setVariable(taskParams.WebAppUri, await appServiceUtility.getApplicationURL());
        }

        if(taskParams.isLinuxApp) {
            switch(taskParams.ImageSource) {
                case 'Builtin': {
                    var webPackage = packageUtility.PackageUtility.getPackagePath(taskParams.Package);
                    tl.debug('Performing Linux built-in package deployment');
                    await kuduServiceUtility.deployWebPackage(webPackage, '/site/wwwroot', '/', taskParams.TakeAppOfflineFlag);
                    await appServiceUtility.updateStartupCommandAndRuntimeStack(taskParams.RuntimeStack, taskParams.StartupCommand);

                }
                case 'Registry': {
                    tl.debug("Performing container based deployment.");
                    let containerDeploymentUtility: ContainerBasedDeploymentUtility = new ContainerBasedDeploymentUtility(appService);
                    await containerDeploymentUtility.deployWebAppImage(taskParams);
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
                await msDeploy.DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
                    taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
                    taskParams.AdditionalArguments, isFolderBasedDeployment, taskParams.UseWebDeploy);
            }
            else {
                tl.debug("Initiated deployment via kudu service for webapp package : ");
                await kuduServiceUtility.deployWebPackage(webPackage, physicalPath, taskParams.VirtualApplication, taskParams.TakeAppOfflineFlag);
            }
        }

        if(taskParams.AppSettings && !(taskParams.isLinuxApp && taskParams.isBuiltinLinuxWebApp)) {
            var customApplicationSettings = ParameterParser.parse(taskParams.AppSettings);
            await appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
        }

        if(taskParams.ScriptType) {
            await kuduServiceUtility.runPostDeploymentScript(taskParams);   
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
            await kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: appService.getSlot()});
        }
    }
}

main();
