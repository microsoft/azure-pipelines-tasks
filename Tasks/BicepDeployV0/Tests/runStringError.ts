// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as path from "path";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import { environmentData, setupMockAzureEndpoint } from './utils';

let taskPath = path.join(__dirname, "..", "main.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection
setupMockAzureEndpoint('AzureRM');

// Set minimal required inputs that parseConfig validates before getTemplateAndParameters is called
tr.setInput('ConnectedServiceName', 'AzureRM');
tr.setInput('type', 'deployment');
tr.setInput('operation', 'create');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', 'test-sub-id');
tr.setInput('resourceGroupName', 'test-rg');

// Clone bicep-deploy-common and override getTemplateAndParameters to throw string error
const bicepCommon = require('@azure/bicep-deploy-common');
const bicepCommonClone = Object.assign({}, bicepCommon);
bicepCommonClone.getTemplateAndParameters = function() {
  throw `This is an error!`;
};
tr.registerMock('@azure/bicep-deploy-common', bicepCommonClone);

tr.run();
