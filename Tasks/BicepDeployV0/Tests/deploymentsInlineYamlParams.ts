// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData, setupMockAzureEndpoint, createMockAuthHelper } from './utils';

// Mock deploymentValidate to return successful validation
const mockDeploymentValidate = async () => {
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

// Mock the deployments module
rewiremock('@azure/bicep-deploy-common/deployments')
  .callThrough()
  .with({ deploymentValidate: mockDeploymentValidate });

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

// Mock auth helper to prevent actual Azure login
tr.registerMock('./auth', createMockAuthHelper());

tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deployment');
tr.setInput('operation', 'validate');
tr.setInput('name', 'test-validate');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('templateFile', path.join(__dirname, 'files', 'basic', 'main.bicep'));
tr.setInput('parameters', `intParam: 42
stringParam: hello world
objectParam:
  prop1: value1
  prop2: value2`);

tr.run();

rewiremock.disable();
