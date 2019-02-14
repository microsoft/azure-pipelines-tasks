"use strict";

import tl = require('vsts-task-lib/task');

export const namespace: string = tl.getInput("namespace", false);
export const containers: string[] = tl.getDelimitedInput("containers", "\n");
export const manifests = tl.getInput("manifests", false);
export const canaryPercentage: string = tl.getInput("percentage");
export const deploymentStrategy: string = tl.getInput("deploymentStrategy", false);
export const deleteResourcesBy: string = tl.getInput("deleteResourcesBy", false);
export const manifestsToDelete: string = tl.getInput("manifestsToDelete", false);
export const kinds: string = tl.getInput("kinds", false);
export const names: string[] = tl.getDelimitedInput("names", ",", false);
export const labels: string = tl.getInput("labels", false);
export const cascade: boolean = tl.getBoolInput("cascade", false);
export const gracePeriod: string = tl.getInput("gracePeriod", false);