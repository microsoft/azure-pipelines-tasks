import tl = require('azure-pipelines-task-lib/task');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { Resources } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource';

export class AzureResourceFilterUtils {
    public static async getResourceGroupName(endpoint: AzureEndpoint, resourceType: string, resourceName: string): Promise<string> {
        var azureResources: Resources = new Resources(endpoint);
        var filteredResources: Array<any> = await azureResources.getResources(resourceType, resourceName);
        let resourceGroupName: string;
        if(!filteredResources || filteredResources.length == 0) {
            throw new Error(tl.loc('ResourceDoesntExist', resourceName));
        }
        else if(filteredResources.length == 1) {
            resourceGroupName = filteredResources[0].id.split("/")[4];
        }
        else {
            throw new Error(tl.loc('MultipleResourceGroupFoundForAppService', resourceName));
        }

        return resourceGroupName;
    }
}