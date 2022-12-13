import tl = require('azure-pipelines-task-lib/task');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { Resources } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-resource';

export class AzureResourceFilterUtility {
    public static async getAzureSpringCloudResourceId(endpoint: AzureEndpoint, resourceName: string): Promise<string> {
        tl.debug('Looking up Azure Spring Cloud Instance ' + resourceName);
        var azureResources: Resources = new Resources(endpoint);
        var filteredResources: Array<any> = await azureResources.getResources('Microsoft.AppPlatform/Spring', resourceName);
        let resourceId: string;
        if (!filteredResources || filteredResources.length == 0) {
            throw new Error(tl.loc('ResourceDoesntExist', resourceName));
        }
        else if (filteredResources.length == 1) {
            resourceId = filteredResources[0].id;
        }
        else { //Should never ever ever happen
            throw new Error(tl.loc('DuplicateAzureSpringAppsName'));
        }
        tl.debug('Azure Spring Cloud Lookup completed');
        return resourceId;
    }
}