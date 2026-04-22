// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import { createDeploymentMockRunner } from './utils';

// Mock deploymentCreate to return successful deployment (no outputs needed for this test)
const mockDeploymentCreate = async () => {
  return {
    properties: {
      outputs: {}
    }
  };
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the deployments module
rewiremock('@azure/bicep-deploy-common/deployments')
  .callThrough()
  .with({ deploymentCreate: mockDeploymentCreate });

let tr = createDeploymentMockRunner(rewiremock);

tr.setInput('operation', 'create');
tr.setInput('name', 'test-create-no-param');
tr.setInput('templateFile', path.join(__dirname, 'files', 'basic', 'main.bicep'));
// parametersFile is intentionally NOT set — simulates user leaving it empty.
// In ADO, filePath-type inputs resolve empty values to Build.SourcesDirectory,
// so isFilePathSupplied should return false and the task should succeed without a parameters file.

tr.run();

rewiremock.disable();
