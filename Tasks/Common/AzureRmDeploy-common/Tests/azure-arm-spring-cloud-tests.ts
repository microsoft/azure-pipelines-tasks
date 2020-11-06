import { AzureSpringCloud } from '../azure-arm-rest/azure-arm-spring-cloud';
import { getMockEndpoint, mockAzureAppServiceTests, mockAzureSpringCloudTests } from './mock_utils';
import tl = require('azure-pipelines-task-lib/task');
var endpoint = getMockEndpoint();

mockAzureSpringCloudTests();

class AzureSpringCloudTests {
    protected async deployApplication(){
        var azureSpringCloud : AzureSpringCloud = new AzureSpringCloud(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        try {
            await azureSpringCloud.deployApplication("MOCK_APP", "MOCK_DEPLOYMENT", ".");
        } catch (error){
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureSpringCloudTests.deployApplication() should have passed but failed.')
        }
    }
}