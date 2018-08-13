import tl = require('vsts-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { BuiltInLinuxWebAppDeploymentProvider } from '../deploymentProvider/BuiltInLinuxWebAppDeploymentProvider'
import { AzureRmWebAppDeploymentProvider } from '../deploymentProvider/AzureRmWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'webdeployment-common/packageUtility';
import { getMockEndpoint, mockAzureAppServiceTests, mockKuduServiceTests, mockAzureARMResourcesTests, mockAzureARMPreDeploymentSteps} from 'azure-arm-rest/tests/mock_utils';

getMockEndpoint();
mockAzureAppServiceTests();
mockKuduServiceTests();
mockAzureARMPreDeploymentSteps();

export class AzureRmWebAppDeploymentProviderL0Tests  {

    public static async startAzureRmWebAppDeploymentProviderL0Tests() {
        await AzureRmWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps();
    }

    public static async testForPreDeploymentSteps() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var azureRmWebAppDeploymentProvider : AzureRmWebAppDeploymentProvider  = new AzureRmWebAppDeploymentProvider(taskParameters);
            azureRmWebAppDeploymentProvider.PreDeploymentStep();
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps should succeeded with AppServiceApplicationUrl=http://mytestapp.azurewebsites.net but failed with error');
        }
    }

}

AzureRmWebAppDeploymentProviderL0Tests.startAzureRmWebAppDeploymentProviderL0Tests();