// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import * as crypto from 'crypto';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData, createMockRestError, setupMockAzureEndpoint } from './utils';

// Mock stackCreate to throw deployment error
const mockStackCreate = async () => {
  const errorCorrelationId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const error = {
    code: "DeploymentStackDeploymentFailed",
    message: `One or more resources could not be deployed. Correlation id: '${errorCorrelationId}'.`,
    details: [
      {
        code: "DeploymentFailed",
        target: `/subscriptions/${environmentData.subscriptionId}/resourceGroups/${environmentData.resourceGroupName}/providers/Microsoft.Resources/deployments/e2e-create-251130211keuw`,
        message: "At least one resource deployment operation failed. Please list deployment operations for details. Please see https://aka.ms/arm-deployment-operations for usage details.",
        details: []
      }
    ]
  };
  
  throw createMockRestError('Stack create failed', error, correlationId);
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the stacks module
rewiremock('@azure/bicep-deploy-common/stacks')
  .callThrough()
  .with({ stackCreate: mockStackCreate });

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deploymentStack');
tr.setInput('operation', 'create');
tr.setInput('name', 'test-create');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('parametersFile', path.join(__dirname, 'files', 'deployerror', 'main.bicepparam'));
tr.setInput('actionOnUnmanageResources', 'detach');
tr.setInput('actionOnUnmanageResourceGroups', 'detach');
tr.setInput('denySettingsMode', 'none');

tr.run();

rewiremock.disable();
