// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import { createStackMockRunner } from './utils';

// Mock stackValidate to return successful validation
// Note: validate operations do not set output variables (only create does)
const mockStackValidate = async () => {
  return {
    properties: {}
  };
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
tr.setInput('templateFile', path.join(__dirname, 'files', 'basic', 'main.bicep'));
tr.setInput('parameters', `intParam: 42
stringParam: hello world
objectParam:
  prop1: value1
  prop2: value2`);

tr.run();

rewiremock.disable();
