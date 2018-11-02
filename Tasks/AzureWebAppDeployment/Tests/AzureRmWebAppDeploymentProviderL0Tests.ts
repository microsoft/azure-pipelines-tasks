import tl = require('vsts-task-lib');
import { AzureRmWebAppDeploymentProvider } from '../deploymentProvider/AzureRmWebAppDeploymentProvider'
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../taskparameters';
import { getMockEndpoint } from '../node_modules/azurermdeploycommon/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();

export class AzureRmWebAppDeploymentProviderL0Tests  {

    public static async startAzureRmWebAppDeploymentProviderL0Tests() {
        await AzureRmWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps();
        await AzureRmWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus();
    }

    public static async testForPreDeploymentSteps() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            var azureRmWebAppDeploymentProvider : AzureRmWebAppDeploymentProvider  = new AzureRmWebAppDeploymentProvider(taskParameters);
            await azureRmWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps should succeeded but failed with error ' + error);
        }
    }

    public static async testForUpdateDeploymentStatus() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            var azureRmWebAppDeploymentProvider : AzureRmWebAppDeploymentProvider  = new AzureRmWebAppDeploymentProvider(taskParameters);
            await azureRmWebAppDeploymentProvider.PreDeploymentStep();
            await azureRmWebAppDeploymentProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus steps should succeeded but failed with error ' + error);
        }
    }

}

AzureRmWebAppDeploymentProviderL0Tests.startAzureRmWebAppDeploymentProviderL0Tests();
