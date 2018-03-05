import tl = require('vsts-task-lib/task');
import fs = require('fs');
import path = require('path');
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from './AzureAppServiceUtility';
import { TaskParameters } from './TaskParameters';
import { sleepFor } from 'azure-arm-rest/webClient';

var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');

export async function DeployWar(webPackage, taskParams: TaskParameters, msDeployPublishingProfile, kuduService: Kudu, appServiceUtility: AzureAppServiceUtility): Promise<void> {
    // get list of files before deploying to the web app.
    var listOfFilesBeforeDeployment = await kuduService.listDir('/site/wwwroot/webapps/');
    tl.debug(tl.loc("ExistingFilesBeforeDeployment") + JSON.stringify(listOfFilesBeforeDeployment));

    var retryCount = 3;
    while (retryCount > 0) {
        await msDeploy.DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
            taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
            taskParams.AdditionalArguments, false, taskParams.UseWebDeploy);

        // verify if the war file has expanded
        // if not expanded, deploy using msdeploy once more, to make it work.
        var hasWarExpandedSuccessfully: boolean = await HasWarExpandedSuccessfully(kuduService, listOfFilesBeforeDeployment, taskParams.WebAppName, webPackage, appServiceUtility);
        if (!hasWarExpandedSuccessfully) {
            console.log(tl.loc("WarDeploymentRetry"));
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
    tl.debug(tl.loc("FileExistingAfterDeployment") + JSON.stringify(filesAfterDeployment));

    // Strip package path and only keep the package name.
    packageName = path.basename(packageName).split('.war')[0];

    // Find if directory with same name as war file, existed before deployment
    var directoryWithSameNameBeforeDeployment;
    filesBeforeDeployment.some(item => {
        if (item.name == packageName && item.mime == "inode/directory") {
            directoryWithSameNameBeforeDeployment = item;
            return true;
        }
        return false;
    });

    // Verify if the content of that war file has successfully expanded. This is can be concluded if
    // directory with same name as war file exists after deployment and if it existed before deployment, then the directory should contain content of new war file
    // which can be concluded if the modified time of the directory has changed.
    return filesAfterDeployment.some(item => { return item.name == packageName && item.mime == "inode/directory" && (!directoryWithSameNameBeforeDeployment || item.mtime != directoryWithSameNameBeforeDeployment.mtime) });
}