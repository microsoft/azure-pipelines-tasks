// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Import and configure rewiremock BEFORE anything else loads
const rewiremock = require('rewiremock/node');

import * as path from "path";
import { createDeploymentMockRunner } from './utils';

// Mock execute to throw a string error
const mockExecute = async () => {
  throw `This is an error!`;
};

// Enable rewiremock globally
rewiremock.enable();

// Mock the main module to override execute
rewiremock('@azure/bicep-deploy-common')
  .callThrough()
  .with({ execute: mockExecute });

let tr = createDeploymentMockRunner();

tr.setInput('operation', 'create');
tr.setInput('templateFile', path.join(__dirname, 'files', 'basic', 'main.json'));

tr.run();

rewiremock.disable();
