
import tl = require('azure-pipelines-task-lib/task');
import { TaskParameters, TaskParametersUtility } from './operations/taskparameters';

import { AzureSpringAppsDeploymentProvider } from './deploymentProvider/AzureSpringAppsDeploymentProvider'
import path = require('path');

export async function main() {
    let isDeploymentSuccess: boolean = true;

    console.log('Starting deployment task execution');
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    tl.setResourcePath(path.join(__dirname, 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));
    tl.setResourcePath(path.join(__dirname, 'node_modules/azure-pipelines-tasks-webdeployment-common/module.json'));
    var taskParams: TaskParameters = TaskParametersUtility.getParameters();
    var deploymentProvider = new AzureSpringAppsDeploymentProvider(taskParams);

    tl.debug("Pre-deployment Step Started");
    await deploymentProvider.PreDeploymentStep();

    tl.debug("Deployment Step Started");
    await deploymentProvider.DeployAppStep();

}


process.on('unhandledRejection', ((error: Error) => {
    tl.error("Deployment failed with error: " + error);
    tl.setResult(tl.TaskResult.Failed, error.message);
}));


main().catch((error: Error) => {
    tl.error("Deployment Failed with Error: " + JSON.stringify(error));
    tl.setResult(tl.TaskResult.Failed, error.message);
});
