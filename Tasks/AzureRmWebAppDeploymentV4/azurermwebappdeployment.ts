import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { TaskParameters, TaskParametersUtility } from './operations/TaskParameters';
import { DeploymentFactory } from './deploymentProvider/DeploymentFactory';
import * as Endpoint from 'azure-arm-rest-v2/azure-arm-endpoint';

async function main() {
    let isDeploymentSuccess: boolean = true;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/webdeployment-common-v2/module.json'));
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
        var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParams);
        var deploymentProviders = await deploymentFactory.GetDeploymentProviders();

        await Promise.all(deploymentProviders.map(async deploymentProvider => {
            try {
                tl.debug("Predeployment Step Started");
                await deploymentProvider.PreDeploymentStep();
        
                tl.debug("Deployment Step Started");
                await deploymentProvider.DeployWebAppStep();
            }
            catch(error) {
                tl.debug("Deployment Failed with Error: " + error);
                deploymentProvider.isDeploymentSuccess = false;
                isDeploymentSuccess = false;
            }
        }));
    }
    catch(error) {
        tl.debug("Task Failed with Error: " + error);
        isDeploymentSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        if (deploymentProviders != null && deploymentProviders.length > 0) {
            await deploymentProviders.forEach(async deploymentProvider => {
                await deploymentProvider.UpdateDeploymentStatus();
            });
        }
        
        if (!isDeploymentSuccess ) {
            tl.setResult(tl.TaskResult.Failed, "One or more deployment operations failed");
        }

        Endpoint.dispose();
        tl.debug(isDeploymentSuccess ? "Deployment Succeded" : "Deployment failed");
    }
}

main();
