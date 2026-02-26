// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData, createMockRestError, setupMockAzureEndpoint, createMockAuthHelper } from './utils';

// Mock deploymentCreate to throw deployment error
const mockDeploymentCreate = async () => {
  const error = {
    code: "DeploymentFailed",
    target: `/subscriptions/${environmentData.subscriptionId}/resourceGroups/${environmentData.resourceGroupName}/providers/Microsoft.Resources/deployments/e2e-create`,
    message: "At least one resource deployment operation failed. Please list deployment operations for details. Please see https://aka.ms/arm-deployment-operations for usage details.",
    details: [
      {
        code: "ResourceNotFound",
        message: `The Resource 'Microsoft.Storage/storageAccounts/foo' under resource group '${environmentData.resourceGroupName}' was not found. For more details please go to https://aka.ms/ARMResourceNotFoundFix`
      }
    ]
  };
  
  throw createMockRestError('Deployment failed', error, undefined);
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the deployments module - this will intercept ALL requires of it, including internal ones
rewiremock('@azure/bicep-deploy-common/deployments')
  .callThrough()
  .with({ deploymentCreate: mockDeploymentCreate });

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

// Mock auth helper to prevent actual Azure login
tr.registerMock('./auth', createMockAuthHelper());

tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deployment');
tr.setInput('operation', 'create');
tr.setInput('name', 'test-create');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('parametersFile', path.join(__dirname, 'files', 'deployerror', 'main.bicepparam'));

tr.run();

rewiremock.disable();
