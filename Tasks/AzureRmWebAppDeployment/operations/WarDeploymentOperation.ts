import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { AzureResourceFilterUtility } from './AzureResourceFilterUtility';
import { KuduServiceUtility } from './KuduServiceUtility';
import { AzureAppService } from 'azure-arm-rest/azure-arm-app-service';
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from './AzureAppServiceUtility';
import { ContainerBasedDeploymentUtility } from './ContainerBasedDeploymentUtility';
import { TaskParameters, TaskParametersUtility } from './TaskParameters';
import { FileTransformsUtility } from './FileTransformsUtility';
import * as ParameterParser from '../parameterparser';
import { addReleaseAnnotation } from './ReleaseAnnotationUtility';
import { sleepFor } from 'azure-arm-rest/webClient';

var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');

export async function DeployWar(webPackage, taskParams: TaskParameters, msDeployPublishingProfile, kuduService: Kudu, appServiceUtility: AzureAppServiceUtility): Promise<any> {
    // get list of files before deploying to the web app.
    var listOfFilesBeforeDeployment = await kuduService.listDir('/site/wwwroot/webapps/');

    var retryCount = 3;
    while (retryCount > 0) {
        await msDeploy.DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
            taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
            taskParams.AdditionalArguments, false, taskParams.UseWebDeploy);

        // verify if the war file has expanded
        // if not expanded, deploy using msdeploy once more, to make it work.
        var hasWarExpandedSuccessfully: boolean = await HasWarExpandedSuccessfully(kuduService, listOfFilesBeforeDeployment, taskParams.WebAppName, webPackage, appServiceUtility)
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

export async function HasWarExpandedSuccessfully(kuduService, filesBeforeDeployment, webAppName: string, packageName: string, appServiceUtility: AzureAppServiceUtility): Promise<boolean> {
    // Waiting for war to expand
    await sleepFor(10);
    // do a get call on the target web app.
    await appServiceUtility.pingApplication();
    var filesAfterDeployment = await kuduService.listDir('/site/wwwroot/webapps/');
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
     return filesAfterDeployment.some(item => { return item.name == packageName && item.mime == "inode/directory" && (!directoryWithSameNameBeforeDeployment || item.mtime != directoryWithSameNameBeforeDeployment.mtime) });
}