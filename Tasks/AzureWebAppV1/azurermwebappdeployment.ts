import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as Endpoint from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { TaskParameters, TaskParametersUtility } from './taskparameters';
import { DeploymentFactory } from './deploymentProvider/DeploymentFactory';

async function main() {
    let isDeploymentSuccess: boolean = true;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));
        var taskParams: TaskParameters = await TaskParametersUtility.getParameters();
        var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParams);
        var deploymentProvider = await deploymentFactory.GetDeploymentProvider();

        tl.debug("Predeployment Step Started");
        await deploymentProvider.PreDeploymentStep();

        tl.debug("Deployment Step Started");
        await deploymentProvider.DeployWebAppStep();
    }
    catch(error) {
        tl.debug("Deployment Failed with Error: " + error);
        isDeploymentSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        if(deploymentProvider != null) {
            await deploymentProvider.UpdateDeploymentStatus(isDeploymentSuccess);
        }
        
        Endpoint.dispose();
        tl.debug(isDeploymentSuccess ? "Deployment Succeeded" : "Deployment failed");

    }
}

main();
