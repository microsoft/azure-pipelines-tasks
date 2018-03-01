import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import http = require('http');
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
    let zipDeploymentID: string;
    let isDeploymentSuccess: boolean = true;
    let kuduServiceUtility: KuduServiceUtility;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(taskParams.connectedServiceName).getEndpoint();
        var virtualApplicationPath: string;
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParams.WebAppName));
        if (!taskParams.DeployToSlotFlag) {
            taskParams.ResourceGroupName = await AzureResourceFilterUtility.getResourceGroupName(azureEndpoint, taskParams.WebAppName);
        }

        tl.debug(`Resource Group: ${taskParams.ResourceGroupName}`);
        var appService: AzureAppService = new AzureAppService(azureEndpoint, taskParams.ResourceGroupName, taskParams.WebAppName, taskParams.SlotName, taskParams.WebAppKind);
        let appServiceUtility: AzureAppServiceUtility = new AzureAppServiceUtility(appService);

        await appServiceUtility.pingApplication();
        let kuduService: Kudu = await appServiceUtility.getKuduService();
        kuduServiceUtility = new KuduServiceUtility(kuduService);
        if (taskParams.WebAppUri) {
            tl.setVariable(taskParams.WebAppUri, await appServiceUtility.getApplicationURL());
        }

        if (taskParams.isLinuxApp) {
            switch (taskParams.ImageSource) {
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
            if (taskParams.VirtualApplication) {
                physicalPath = await appServiceUtility.getPhysicalPath(taskParams.VirtualApplication);
                await kuduServiceUtility.createPathIfRequired(physicalPath);
                virtualApplicationPath = physicalPath;
            }

            webPackage = await FileTransformsUtility.applyTransformations(webPackage, taskParams);

            if (deployUtility.canUseWebDeploy(taskParams.UseWebDeploy)) {
                tl.debug("Performing the deployment of webapp.");
                if (!tl.osType().match(/^Win/)) {
                    throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
                }

                if (taskParams.RenameFilesFlag) {
                    await appServiceUtility.enableRenameLockedFiles();
                }

                var msDeployPublishingProfile = await appServiceUtility.getWebDeployPublishingProfile();
                // this is being done temporarily, to tackle war files not getting expanded (only for the first deployment to the web app) when done using MSDeploy.
                if (webPackage.toString().toLowerCase().endsWith('.war')) {
                    // get list of files before deploying to the web app.
                    var listOfFilesBeforeDeployment = await kuduService.listDir('/site/wwwroot/webapps/');

                    var retryCount = 3;
                    while (retryCount > 0) {
                        await msDeploy.DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
                            taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
                            taskParams.AdditionalArguments, isFolderBasedDeployment, taskParams.UseWebDeploy);

                        // verify if the war file has expanded
                        // if not expanded, deploy using msdeploy once more, to make it work.
                        var hasWarExpandedSuccessfully: boolean = await HasWarExpandedSuccessfully(kuduService, listOfFilesBeforeDeployment, taskParams.WebAppName, webPackage)
                        if (!hasWarExpandedSuccessfully) {
                            // If the war file is exactly same, MSDeploy doesn't update the war file in webapp.
                            // So by changing ModifiedTime, we ensure it will be updated.
                            var currentTime = new Date(Date.now());
                            var modifiedTime = new Date(Date.now());
                            fs.utimesSync(webPackage, currentTime, modifiedTime);
                        }
                        else {
                            break;
                        }

                        retryCount--;
                    }
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

        if (!taskParams.isContainerWebApp) {
            if (taskParams.AppSettings) {
                var customApplicationSettings = ParameterParser.parse(taskParams.AppSettings);
                await appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
            }

            if (taskParams.ConfigurationSettings) {
                var customApplicationSettings = ParameterParser.parse(taskParams.ConfigurationSettings);
                await appServiceUtility.updateConfigurationSettings(customApplicationSettings);
            }
        }
        else {
            tl.debug('App Settings and config settings are already updated during container based deployment.')
        }

        if (taskParams.ScriptType) {
            await kuduServiceUtility.runPostDeploymentScript(taskParams, virtualApplicationPath);
        }

        await appServiceUtility.updateScmTypeAndConfigurationDetails();
    }
    catch (error) {
        isDeploymentSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        if (kuduServiceUtility) {
            await addReleaseAnnotation(azureEndpoint, appService, isDeploymentSuccess);
            let activeDeploymentID: string = await kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, { 'type': 'Deployment', slotName: appService.getSlot() });
            if (zipDeploymentID && activeDeploymentID && isDeploymentSuccess) {
                await kuduServiceUtility.postZipDeployOperation(zipDeploymentID, activeDeploymentID);
            }
        }
        else {
            tl.debug('Cannot update deployment status as Kudu is not initialized');
        }
    }
}

async function HasWarExpandedSuccessfully(kuduService, filesBeforeDeployment, webAppName: string, packageName: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        // Waiting for war to expand
        var sleep = SleepFunction(10);
        sleep.then(() => {
            // do a get call on the target web app.
            var callWebApp = CallDeployedWebApp(webAppName);
            callWebApp.then(() => {
                var filesAfterDeployment = kuduService.listDir('/site/wwwroot/webapps/');
                filesAfterDeployment.then((files) => {
                    // Strip package path and only keep the package name.
                    packageName = packageName.split('\\').find(x => x.toLowerCase().endsWith('.war')).split('.')[0];

                    // Find if directory with same name as war file, existed before deployment
                    var directoryWithSameNameBeforeDeployment;
                    filesBeforeDeployment.some(item => {
                        if (item.name == packageName) {
                            directoryWithSameNameBeforeDeployment = item;
                            return true;
                        }
                        return false;
                    });

                    // Verify if the content of that war file has successfully expanded. This is can be concluded if
                    // direcotry with same name as war file exists after deployment and if it existed before deployment, then the directorys should contain content of new war file
                    // which can be concluded if the modified time of the directory has changed.
                    resolve(files.some(item => { return item.name == packageName && item.mime == "inode/directory" && (!directoryWithSameNameBeforeDeployment || item.mtime != directoryWithSameNameBeforeDeployment.mtime) }));
                })
            });
        });
    });
}

async function SleepFunction(timeoutInSeconds: number): Promise<void> {
    return new Promise<void>((resolve, reject) => setTimeout(resolve, timeoutInSeconds * 1000));
}

async function CallDeployedWebApp(webAppName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const req = http.get({ host: webAppName + '.azurewebsites.net' });
        req.end();
        req.once('response', (res) => {
            resolve();
        });
        req.on('error', (err) => {
            //do nothing
        });
    });
}

main();
