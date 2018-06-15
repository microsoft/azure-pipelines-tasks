import tl = require('vsts-task-lib/task');
import Q = require('q');
import path = require('path');
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-arm-rest/azureModels';
import {AzureAppService  } from 'azure-arm-rest/azure-arm-app-service';
import {AzurePolicy  } from 'azure-arm-rest/azure-arm-policy';
import { AzureApplicationInsights } from 'azure-arm-rest/azure-arm-appinsights';
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { ApplicationInsightsWebTests } from 'azure-arm-rest/azure-arm-appinsights-webtests';
import { Resources } from 'azure-arm-rest/azure-arm-resource';
import { AzureAppServiceUtils } from './operations/AzureAppServiceUtils';
import { KuduServiceUtils } from './operations/KuduServiceUtils';
import { AzureResourceFilterUtils } from './operations/AzureResourceFilterUtils';
import { enableContinuousMonitoring } from './operations/ContinuousMonitoringUtils';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));
        var connectedServiceName = tl.getInput('ConnectedServiceName', true);
        var action = tl.getInput('Action', true);
        var policybody = tl.getInput('Arguments',false);
        var policyname = tl.getInput('PolicyName', false);
        var taskResult = true;
        var errorMessage: string = "";
        var updateDeploymentStatus: boolean = true;
        var azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(connectedServiceName).getEndpoint();
        var policy_instance: AzurePolicy = new AzurePolicy(azureEndpoint,policyname);
        
        console.log(action);
        switch(action)
        {
            case "List Policy":
            {
                policy_instance.listp();
                break;
            }
            case "Create Policy":
            {
                policy_instance.createp(policybody);
                break;
            }
            default:
            {
                    throw Error(tl.loc('InvalidAction'));
            }
        }
    }
    catch(exception) {
        taskResult = false;
        errorMessage = exception;
        }
}

run();