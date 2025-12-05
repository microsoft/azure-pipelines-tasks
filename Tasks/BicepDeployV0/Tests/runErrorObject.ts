// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as path from "path";
import * as tmrm from "azure-pipelines-task-lib/mock-run";
import { environmentData } from './utils';

let taskPath = path.join(__dirname, "..", "main.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set task inputs
tr.setInput('type', 'deployment');
tr.setInput('name', 'test-deployment');
tr.setInput('operation', 'create');
tr.setInput('scope', 'resourceGroup');
tr.setInput('subscriptionId', environmentData.subscriptionId);
tr.setInput('resourceGroupName', environmentData.resourceGroupName);
tr.setInput('location', 'eastus');
tr.setInput('templateFile', path.join(__dirname, "files", "valid", "main.bicep"));
tr.setInput('parametersFile', path.join(__dirname, "files", "valid", "main.bicepparam"));

// Clone bicep-deploy-common and override getTemplateAndParameters to throw Error object
const bicepCommon = require('@azure/bicep-deploy-common');
const bicepCommonClone = Object.assign({}, bicepCommon);
bicepCommonClone.getTemplateAndParameters = function() {
  throw new Error(`This is an error!`);
};
tr.registerMock('@azure/bicep-deploy-common', bicepCommonClone);

tr.run();
