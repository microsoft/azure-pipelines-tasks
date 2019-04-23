"use strict";

import tl = require('vsts-task-lib/task');

export const namespace: string = tl.getInput("namespace", false);
export const containers: string[] = tl.getDelimitedInput("containers", "\n");
export const imagePullSecrets: string[] = tl.getDelimitedInput("imagePullSecrets", "\n");
export const manifests = tl.getInput("manifests", false);
export const canaryPercentage: string = tl.getInput("percentage");
export const deploymentStrategy: string = tl.getInput("strategy", false);
export const args: string = tl.getInput("arguments", false);
export const secretArguments: string = tl.getInput("secretArguments", false);
export const secretType: string = tl.getInput("secretType", false);
export const secretName: string = tl.getInput("secretName", false);
export const dockerRegistryEndpoint: string = tl.getInput("dockerRegistryEndpoint", false);