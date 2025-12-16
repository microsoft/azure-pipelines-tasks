// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import * as crypto from 'crypto';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData, createMockRestError, createValidationFailureError, setupMockAzureEndpoint } from './utils';

// Mock stackValidate to throw validation error
const mockStackValidate = async () => {
  const trackingId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  const error = createValidationFailureError('e2e-validate', trackingId);
  throw createMockRestError('Stack validation failed', error, correlationId);
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the stacks module
rewiremock('@azure/bicep-deploy-common/stacks')
  .callThrough()
  .with({ stackValidate: mockStackValidate });

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deploymentStack');
tr.setInput('operation', 'validate');
tr.setInput('name', 'test-validate');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('parametersFile', path.join(__dirname, 'files', 'validationerror', 'main.bicepparam'));
tr.setInput('actionOnUnmanageResources', 'detach');
tr.setInput('actionOnUnmanageResourceGroups', 'detach');
tr.setInput('denySettingsMode', 'none');

tr.run();

rewiremock.disable();
