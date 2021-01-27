console.log('Starting it up. 4');
import tl = require('azure-pipelines-task-lib/task');
console.log('2');
import { TaskParameters, TaskParametersUtility } from './operations/taskparameters';
console.log('3');
import { AzureSpringCloudDeploymentProvider } from './deploymentProvider/AzureSpringCloudDeploymentProvider'
console.log('4');
import path = require('path');
console.log('5');
async function main() {
    console.log('7');
    let isDeploymentSuccess: boolean = true;
    console.log('So... here we are 4.');
    try {
        console.log('Starting deployment task execution');
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/module.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/webdeployment-common-v2/module.json'));
        console.log('8');
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
        console.log('9');
        var deploymentProvider = new AzureSpringCloudDeploymentProvider(taskParams);
        console.log('10');
        tl.debug("Predeployment Step Started");
        await deploymentProvider.PreDeploymentStep();

        tl.debug("Deployment Step Started");
        await deploymentProvider.DeployAppStep();
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
        
     //   Endpoint.dispose();
        tl.debug(isDeploymentSuccess ? "Deployment Succeded" : "Deployment failed");

    }
}
console.log('6');
main();