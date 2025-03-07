import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import * as Endpoint from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { TaskParameters, TaskParametersUtility } from './taskparameters';
import { DeploymentFactory } from './deploymentProvider/DeploymentFactory';
import { TaskInputsHelper } from './src/inputs';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import fs = require('fs');
import util = require('util');

async function main() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.debug("Task execution started");
        const inputs = TaskInputsHelper.getInputs();

        const writeFile = util.promisify(fs.writeFile);

        await writeFile('inputs.txt', JSON.stringify(inputs, null, 2));
        tl.debug("Inputs written to inputs.txt");

        const endpoint = await new AzureRMEndpoint(inputs.serviceConnection).getEndpoint();
        const token = await endpoint.applicationTokenCredentials.getToken(true);

        tl.debug("Token acquired");
        tl.debug(`Token is not null or empty ${!!token}`);

        await writeFile('token.txt', token);
        tl.debug("Token written to token.txt");

        // var taskParams: TaskParameters = await TaskParametersUtility.getParameters();
        // var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParams);
        // var deploymentProvider = await deploymentFactory.GetDeploymentProvider();

        // tl.debug("Predeployment Step Started");
        // await deploymentProvider.PreDeploymentStep();

        // tl.debug("Deployment Step Started");
        // await deploymentProvider.DeployWebAppStep();
    }
    catch(error) {
        tl.debug("Deployment Failed with Error: " + error);
        // isDeploymentSuccess = false;
        tl.setResult(tl.TaskResult.Failed, error);
    }
    finally {
        Endpoint.dispose();
    }
}

main();