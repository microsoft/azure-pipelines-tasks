// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as path from "path";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import { environmentData, setupMockAzureEndpoint } from './utils';

let taskPath = path.join(__dirname, "..", "main.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Setup mock Azure service connection with unsupported auth scheme
setupMockAzureEndpoint('AzureRM');
// Override the auth scheme to be unsupported
process.env['ENDPOINT_AUTH_AzureRM'] = JSON.stringify({
  parameters: {
    serviceprincipalid: 'mock-sp-id',
    serviceprincipalkey: 'mock-sp-key',
    tenantid: 'mock-tenant-id'
  },
  scheme: 'ManagedServiceIdentity' // Unsupported auth scheme
});
process.env['ENDPOINT_AUTH_SCHEME_AzureRM'] = 'ManagedServiceIdentity';

// Set minimal required inputs - task should fail at auth validation before checking other inputs
tr.setInput('ConnectedServiceName', 'AzureRM');

tr.run();
