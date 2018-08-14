import tl = require('vsts-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { BuiltInLinuxWebAppDeploymentProvider } from '../deploymentProvider/BuiltInLinuxWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'webdeployment-common/packageUtility';
import { getMockEndpoint, mockAzureAppServiceTests, mockKuduServiceTests, mockAzureARMResourcesTests, mockAzureARMPreDeploymentSteps} from 'azure-arm-rest/tests/mock_utils';

getMockEndpoint();
mockAzureAppServiceTests();
mockKuduServiceTests();
mockAzureARMPreDeploymentSteps();

export class BuiltInLinuxWebAppDeploymentProviderL0Tests  {

    public static async startBuiltInLinuxWebAppDeploymentProviderL0Tests() {
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps_BuiltInLinuxWebApp();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_BuiltInLinuxWebApp();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus_BuiltInLinuxWebApp();
    }

    public static async testForPreDeploymentSteps_BuiltInLinuxWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for built in linux web app should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for built in linux web app failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_BuiltInLinuxWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for built in linux web app with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for built in linux web app with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_BuiltInLinuxWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            await builtInLinuxWebAppDeploymentProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for built in linux web app steps should succeeded but failed with error');
        }
    }

}

BuiltInLinuxWebAppDeploymentProviderL0Tests.startBuiltInLinuxWebAppDeploymentProviderL0Tests();
