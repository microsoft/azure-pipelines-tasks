// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import * as crypto from 'crypto';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData, createMockRestError, createValidationFailureError, setupMockAzureEndpoint, createMockAuthHelper } from './utils';

// Mock deploymentValidate to throw validation error
const mockDeploymentValidate = async () => {
  const correlationId = crypto.randomUUID();
  const error = createValidationFailureError('e2e-validate', correlationId);
  throw createMockRestError('Validation failed', error, correlationId);
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the deployments module
rewiremock('@azure/bicep-deploy-common/deployments')
  .callThrough()
  .with({ deploymentValidate: mockDeploymentValidate });

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

// Mock auth helper to prevent actual Azure login
tr.registerMock('./auth', createMockAuthHelper());

tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deployment');
tr.setInput('operation', 'validate');
tr.setInput('name', 'test-validate');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('parametersFile', path.join(__dirname, 'files', 'validationerror', 'main.bicepparam'));

tr.run();

rewiremock.disable();
