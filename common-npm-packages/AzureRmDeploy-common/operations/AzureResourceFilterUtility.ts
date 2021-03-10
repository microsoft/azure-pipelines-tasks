import tl = require('azure-pipelines-task-lib/task');
import { AzureEndpoint } from '../azure-arm-rest/azureModels';
import { Resources } from '../azure-arm-rest/azure-arm-resource';

export class AzureResourceFilterUtility {
    public static async getAppDetails(endpoint: AzureEndpoint, resourceName: string): Promise<any> {
        var azureResources: Resources = new Resources(endpoint);
        var filteredResources: Array<any> = await azureResources.getResources('Microsoft.Web/Sites', resourceName);
        let resourceGroupName: string;
        let kind: string;
        if(!filteredResources || filteredResources.length == 0) {
            throw new Error(tl.loc('ResourceDoesntExist', resourceName));
        }
        else if(filteredResources.length == 1) {
            resourceGroupName = filteredResources[0].id.split("/")[4];
            kind = filteredResources[0].kind;
        }
        else {
            throw new Error(tl.loc('MultipleResourceGroupFoundForAppService', resourceName));
        }

        return {
            resourceGroupName: resourceGroupName,
            kind: kind
        };
    }
}