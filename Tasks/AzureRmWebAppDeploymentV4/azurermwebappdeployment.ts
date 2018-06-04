import tl = require('vsts-task-lib/task');
import path = require('path');
import { TaskParameters, TaskParametersUtility } from './operations/TaskParameters';
import { DeploymentFactory } from './deploymentProvider/DeploymentFactory';

async function main() {
    let isDeploymentSuccess: boolean = true;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
        var deploymentProvider = await DeploymentFactory.GetDeploymentProvider(taskParams);

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
        tl.debug(isDeploymentSuccess ? "Deployment Succeded" : "");
    }
}

main();
