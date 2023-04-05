import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs')
import armStorage = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-storage');
import msRestAzure = require('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common');
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint, StorageAccount } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';

function isNonEmpty(str: string): boolean {
    return (!!str && !!str.trim());
}

function getResourceGroupNameFromUri(resourceUri: string): string {
    if (isNonEmpty(resourceUri)) {
        resourceUri = resourceUri.toLowerCase();
        return resourceUri.substring(resourceUri.indexOf("resourcegroups/") + "resourcegroups/".length, resourceUri.indexOf("/providers"));
    }

    return "";
}

async function run(): Promise<void> {
    let tempDirectory: string = tl.getVariable('Agent.TempDirectory');
    let fileName: string = Math.random().toString(36).replace('0.', '');
    let file: string = path.resolve(tempDirectory, fileName);
    try {
        const taskManifestPath = path.join(__dirname, "task.json");
        tl.debug("Setting resource path to " + taskManifestPath);
        tl.setResourcePath(taskManifestPath);
        let connectionType = tl.getInput('ConnectedServiceNameSelector', false);
        if(connectionType === 'ConnectedServiceNameARM') {
            let connectedServiceName = tl.getInput('ConnectedServiceNameARM', true);
            let storageAccountName = tl.getInput('StorageAccountRM', true);
            var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
            const storageArmClient = new armStorage.StorageManagementClient(azureEndpoint.applicationTokenCredentials, azureEndpoint.subscriptionID);
            let storageAccount: StorageAccount = await storageArmClient.storageAccounts.get(storageAccountName);
            let storageAccountResourceGroupName = getResourceGroupNameFromUri(storageAccount.id);
            let accessKeys = await storageArmClient.storageAccounts.listKeys(storageAccountResourceGroupName, storageAccountName, null);
            let accessKey: string = accessKeys[0];
            let data: string = `/DestKey:\"${accessKey}\"`;
            let options = { encoding : "utf8" }
            fs.writeFileSync(file, data, options);
            tl.setTaskVariable('AFC_V2_ARM_STORAGE_KEY_FILE', file);
            tl.debug("Response file created");
        }
    } catch(error) {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
        console.log(tl.loc("AFC_PreexecutionJob_UnableToGetStorageKey", error));
    }
}

run()