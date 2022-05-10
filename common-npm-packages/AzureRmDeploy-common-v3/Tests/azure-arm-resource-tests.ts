import { getMockEndpoint, mockAzureARMResourcesTests } from './mock_utils';
import tl = require('azure-pipelines-task-lib/task');
import { Resources } from '../azure-arm-rest/azure-arm-resource';
var endpoint = getMockEndpoint();

mockAzureARMResourcesTests();

class ResourcesTests {
    public static async getResources(resourceType: string, resourceName: string) {
        var resources: Resources = new Resources(endpoint);
        try {
            var result = await resources.getResources(resourceType, resourceName);
            console.log('ResourcesTests - getResources : ' + result.length);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'ResourcesTests.getResources() should have passed but failed');
        }
    }
}

async function RUNTESTS() {
    await ResourcesTests.getResources('Microsoft.Web/sites', 'göm-mig-från-omvärlden');
}

RUNTESTS();