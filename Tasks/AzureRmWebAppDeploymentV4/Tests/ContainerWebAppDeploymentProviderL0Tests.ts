import tl = require('vsts-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { ContainerWebAppDeploymentProvider } from '../deploymentProvider/ContainerWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'webdeployment-common/packageUtility';
import { getMockEndpoint, mockAzureAppServiceTests, mockKuduServiceTests, mockAzureARMResourcesTests, mockAzureARMPreDeploymentSteps} from 'azure-arm-rest/tests/mock_utils';

getMockEndpoint();
mockAzureARMPreDeploymentSteps();

export class ContainerWebAppDeploymentProviderL0Tests  {

    public static async startContainerWebAppDeploymentProviderL0Tests() {
        await ContainerWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps_ContainerWebApp();
        await ContainerWebAppDeploymentProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_ContainerWebApp();
        await ContainerWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus_ContainerWebApp();
    }

    public static async testForPreDeploymentSteps_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for container web app should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for container web app failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for container web app with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for container web app with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            await containerWebAppDeploymentProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for container web app steps should succeeded but failed with error');
        }
    }

}

ContainerWebAppDeploymentProviderL0Tests.startContainerWebAppDeploymentProviderL0Tests();
