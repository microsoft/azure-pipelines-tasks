// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from 'path';
import tmrm = require("azure-pipelines-task-lib/mock-run");
import { environmentData } from './utils';

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

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('type', 'deployment');
tr.setInput('operation', 'whatIf');
tr.setInput('name', 'test-validate');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('parametersFile', path.join(__dirname, 'files', 'basic', 'main.bicepparam'));

tr.run();

rewiremock.disable();
