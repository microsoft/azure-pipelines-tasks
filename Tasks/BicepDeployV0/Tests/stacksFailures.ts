// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import * as crypto from 'crypto';
import { createMockRestError, createValidationFailureError, createStackMockRunner } from './utils';

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

let tr = createStackMockRunner(rewiremock);

tr.setInput('operation', 'validate');
tr.setInput('name', 'test-validate');
tr.setInput('parametersFile', path.join(__dirname, 'files', 'validationerror', 'main.bicepparam'));

tr.run();

rewiremock.disable();
