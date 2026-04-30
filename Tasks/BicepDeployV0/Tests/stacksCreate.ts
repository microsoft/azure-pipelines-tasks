// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import { createStackMockRunner } from './utils';

// Mock stackCreate to return successful stack deployment with outputs
const mockStackCreate = async () => {
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

// Mock the stacks module
rewiremock('@azure/bicep-deploy-common/stacks')
  .callThrough()
  .with({ stackCreate: mockStackCreate });

let tr = createStackMockRunner(rewiremock);

tr.setInput('operation', 'create');
tr.setInput('name', 'test-stack-create');
tr.setInput('parametersFile', path.join(__dirname, 'files', 'basic', 'main.bicepparam'));

tr.run();

rewiremock.disable();
