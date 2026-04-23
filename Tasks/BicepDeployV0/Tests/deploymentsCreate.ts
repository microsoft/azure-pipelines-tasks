// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import { createDeploymentMockRunner } from './utils';

// Mock deploymentCreate to return successful deployment with outputs
const mockDeploymentCreate = async () => {
  return {
    properties: {
      outputs: {
        stringOutput: { type: 'String', value: 'hello world' },
        intOutput: { type: 'Int', value: 42 },
        objectOutput: { type: 'Object', value: { key1: 'value1', key2: 'value2' } }
      }
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
tr.setInput('name', 'test-create');
tr.setInput('parametersFile', path.join(__dirname, 'files', 'basic', 'main.bicepparam'));

tr.run();

rewiremock.disable();
