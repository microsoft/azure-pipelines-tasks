// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import * as crypto from 'crypto';
import { createMockRestError, createValidationFailureError, createDeploymentMockRunner } from './utils';

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

let tr = createDeploymentMockRunner(rewiremock);

tr.setInput('operation', 'validate');
tr.setInput('name', 'test-validate');
tr.setInput('parametersFile', path.join(__dirname, 'files', 'validationerror', 'main.bicepparam'));

tr.run();

rewiremock.disable();
