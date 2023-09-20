import tl = require('azure-pipelines-task-lib/task');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { Resources } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-resource';

export class AzureResourceFilterUtils {
    public static async getResourceGroupName(endpoint: AzureEndpoint, resourceType: string, resourceName: string): Promise<string> {
        const azureResources: Resources = new Resources(endpoint);
        const resources: Array<any> = await azureResources.getResources(resourceType, resourceName);
        const resourceGroupIds: string[] = [...new Set(resources.map(r => r.id as string))];
        if(!resourceGroupIds || resourceGroupIds.length == 0) {
            throw new Error(tl.loc('ResourceDoesntExist', resourceName));
        }
        else if(resourceGroupIds.length > 1) {
            throw new Error(tl.loc('MultipleResourceGroupFoundForAppService', resourceName));
        }
        else {
            return resourceGroupIds[0].split("/")[4];
        }
    }
}