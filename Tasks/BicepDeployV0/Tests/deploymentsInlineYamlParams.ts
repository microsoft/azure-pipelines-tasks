// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import { createDeploymentMockRunner } from './utils';

// Mock deploymentValidate to return successful validation
// Note: validate operations do not set output variables (only create does)
const mockDeploymentValidate = async () => {
  return {
    properties: {}
  };
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
tr.setInput('templateFile', path.join(__dirname, 'files', 'basic', 'main.bicep'));
tr.setInput('parameters', `intParam: 42
stringParam: hello world
objectParam:
  prop1: value1
  prop2: value2`);

tr.run();

rewiremock.disable();
