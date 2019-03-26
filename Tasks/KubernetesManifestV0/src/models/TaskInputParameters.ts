"use strict";

import tl = require('vsts-task-lib/task');

export const namespace: string = tl.getInput("namespace", false);
export const containers: string[] = tl.getDelimitedInput("containers", "\n");
export const manifests = tl.getInput("manifests", false);
export const canaryPercentage: string = tl.getInput("percentage");
export const deploymentStrategy: string = tl.getInput("strategy", false);
export const args: string = tl.getInput("arguments", false);