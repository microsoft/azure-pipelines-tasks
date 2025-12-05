// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData } from './utils';

// Mock stackValidate to return successful validation
const mockStackValidate = async () => {
  return {
    properties: {
      outputs: {
        stringOutput: {
          type: 'String',
          value: 'hello world'
        },
        intOutput: {
          type: 'Int',
          value: 42
        },
        objectOutput: {
          type: 'Object',
          value: {
            prop1: 'value1',
            prop2: 'value2'
          }
        }
      }
    }
  };
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the stacks module
rewiremock('@azure/bicep-deploy-common/stacks')
  .callThrough()
  .with({ stackValidate: mockStackValidate });

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('type', 'deploymentStack');
tr.setInput('operation', 'validate');
tr.setInput('name', 'test-validate');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('parametersFile', path.join(__dirname, 'files', 'basic', 'main.bicepparam'));
tr.setInput('actionOnUnmanageResources', 'detach');
tr.setInput('actionOnUnmanageResourceGroups', 'detach');
tr.setInput('denySettingsMode', 'none');

tr.run();

rewiremock.disable();
