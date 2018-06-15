import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import { AzurePolicy } from 'azure-arm-rest/azure-arm-policy';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var policybody = tl.getInput('Arguments',false);
        var policyname = tl.getInput('PolicyName', false);
        var taskResult = true;
        var errorMessage: string = "";
        var updateDeploymentStatus: boolean = true;
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        var policy_instance: AzurePolicy = new AzurePolicy(azureEndpoint,policyname);
        
        policy_instance.createp(policybody);
    }
    catch(exception) {
        taskResult = false;
        errorMessage = exception;
    }
}

run();