// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import { createDeploymentMockRunner } from './utils';

// Mock deploymentWhatIf to return successful what-if result
const mockDeploymentWhatIf = async () => {
  return {
    status: 'Succeeded',
    properties: {
      changes: [],
      provisioningState: 'Succeeded'
    }
  };
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the deployments module
rewiremock('@azure/bicep-deploy-common/deployments')
  .callThrough()
  .with({ deploymentWhatIf: mockDeploymentWhatIf });

let tr = createDeploymentMockRunner(rewiremock);

tr.setInput('operation', 'whatIf');
tr.setInput('name', 'test-validate');
tr.setInput('parametersFile', path.join(__dirname, 'files', 'basic', 'main.bicepparam'));

tr.run();

rewiremock.disable();
