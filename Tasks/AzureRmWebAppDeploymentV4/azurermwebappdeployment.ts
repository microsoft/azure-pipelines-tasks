import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import dns = require('dns');
import { TaskParameters, TaskParametersUtility } from './operations/TaskParameters';
import { DeploymentFactory } from './deploymentProvider/DeploymentFactory';
import * as Endpoint from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';

async function main() {
    // Set the default result order to ipv4first to avoid issues with slow IPv6 connections
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
        tl.debug("Set default DNS lookup order to ipv4 first");
    }

    let isDeploymentSuccess: boolean = true;

    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        tl.setResourcePath(path.join( __dirname, 'node_modules/azure-pipelines-tasks-webdeployment-common/module.json'));
        var taskParams: TaskParameters = TaskParametersUtility.getParameters();
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
        tl.debug(isDeploymentSuccess ? "Deployment Succeded" : "Deployment failed");

    }
}

main();
