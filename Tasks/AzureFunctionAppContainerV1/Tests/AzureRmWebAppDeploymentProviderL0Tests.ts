import tl = require('azure-pipelines-task-lib');
import { AzureFunctionOnContainerDeploymentProvider } from '../azurefunctiononcontainerprovider'
import { TaskParametersUtility, TaskParameters } from '../taskparameters';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azurermdeploycommon/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockContainerDeploySettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockContainerDeploySettings();

export class AzureRmWebAppDeploymentProviderL0Tests  {

    public static async startAzureRmWebAppDeploymentProviderL0Tests() {
        await AzureRmWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps();
        await AzureRmWebAppDeploymentProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled();
        await AzureRmWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus();
        await AzureRmWebAppDeploymentProviderL0Tests.testForDeployWebSteps_ContainerWebApp();
    }

    public static async testForPreDeploymentSteps() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            var azureRmWebAppDeploymentProvider : AzureFunctionOnContainerDeploymentProvider  = new AzureFunctionOnContainerDeploymentProvider(taskParameters);
            await azureRmWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for container web app should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for container web app failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var azureRmWebAppDeploymentProvider : AzureFunctionOnContainerDeploymentProvider  = new AzureFunctionOnContainerDeploymentProvider(taskParameters);
            await azureRmWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for container web app with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for container web app with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            var azureRmWebAppDeploymentProvider : AzureFunctionOnContainerDeploymentProvider  = new AzureFunctionOnContainerDeploymentProvider(taskParameters);
            await azureRmWebAppDeploymentProvider.PreDeploymentStep();
            await azureRmWebAppDeploymentProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for container web app steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebSteps_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            var azureRmWebAppDeploymentProvider : AzureFunctionOnContainerDeploymentProvider  = new AzureFunctionOnContainerDeploymentProvider(taskParameters);
            await azureRmWebAppDeploymentProvider.PreDeploymentStep();
            await azureRmWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'Web app Deployment steps for container should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'Deployment web app steps for container failed with error');
        }
    }
}

AzureRmWebAppDeploymentProviderL0Tests.startAzureRmWebAppDeploymentProviderL0Tests();
