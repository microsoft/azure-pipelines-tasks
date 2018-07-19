import tl = require('vsts-task-lib/task');
import Q = require('q');
var fs = require('fs');
import path = require('path');
import { AzurePolicy } from 'azure-arm-rest/azure-arm-policy';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';


async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var policyName = tl.getInput('PolicyName', true);
        var action = tl.getInput('Action', true);
        var policyInputType = tl.getInput('PolicyInputType',false);
        var policyFilePath = tl.getInput('PolicyFilePath',false);
        var policyInline = tl.getInput('PolicyInline', false);

        var taskResult = true;
        
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        var azurePolicy: AzurePolicy = new AzurePolicy(azureEndpoint);

        var policyContent;
        
        if (policyInputType == "PolicyFilePath") {
            if(!fs.existsSync(policyFilePath)) {
                throw new Error('File Not Found Exception' + policyFilePath);
            }

            policyContent = fs.readFileSync(policyFilePath, "utf8").toString().trim();
        } else {
            policyContent = policyInline;
        } 
        
        console.log(action);
        switch(action)
        {
            case "CreatePolicy":
            {
                var policy = await azurePolicy.create(policyName, policyContent);
                console.log("Azure policy created successfully");
                tl.debug(JSON.stringify(policy));
                break;
            }
            case "AssignPolicy":
            {
                var policyAssignmentResult = await azurePolicy.assign(policyName, policyContent);
                console.log("Azure policy assigned successfully");
                tl.debug(JSON.stringify(policyAssignmentResult));
                break;
            }
            default:
            {
                    throw Error(tl.loc('InvalidAction'));
            }
        }
    }
    catch(exception) {
        tl.debug(exception);
        tl.setResult(tl.TaskResult.Failed, exception.message);
    }
    finally {
        tl.debug("Deployment succeded");
    }
}

run();