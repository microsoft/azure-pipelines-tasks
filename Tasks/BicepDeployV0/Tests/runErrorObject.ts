// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from "path";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import { setupMockAzureEndpoint, createMockAuthHelper } from './utils';

// Mock execute to throw an Error object
const mockExecute = async () => {
  throw new Error(`This is an error!`);
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the main module to override execute
rewiremock('@azure/bicep-deploy-common')
  .callThrough()
  .with({ execute: mockExecute });

let taskPath = path.join(__dirname, "..", "main.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

// Mock auth helper to prevent actual Azure login
tr.registerMock('./auth', createMockAuthHelper());

// Set minimal required inputs
tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deployment');
tr.setInput('operation', 'create');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', 'test-sub-id');
tr.setInput('resourceGroupName', 'test-rg');
tr.setInput('templateFile', path.join(__dirname, 'files', 'basic', 'main.json'));

tr.run();

rewiremock.disable();
