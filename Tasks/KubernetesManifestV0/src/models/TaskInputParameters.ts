'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import * as canaryDeploymentHelper from '../utils/CanaryDeploymentHelper';

export let namespace: string = tl.getInput('namespace', false);
export const containers: string[] = tl.getDelimitedInput('containers', '\n');
export const imagePullSecrets: string[] = tl.getDelimitedInput('imagePullSecrets', '\n');
export const manifests = tl.getDelimitedInput('manifests', '\n');
export const canaryPercentage: string = tl.getInput('percentage');
export const deploymentStrategy: string = tl.getInput('strategy', false);
export const trafficSplitMethod: string = tl.getInput('trafficSplitMethod', false);
export const baselineAndCanaryReplicas: string = tl.getInput('baselineAndCanaryReplicas', true);
export const args: string = tl.getInput('arguments', false);
export const secretArguments: string = tl.getInput('secretArguments', false) || '';
export const secretType: string = tl.getInput('secretType', false);
export const secretName: string = tl.getInput('secretName', false);
export const dockerRegistryEndpoint: string = tl.getInput('dockerRegistryEndpoint', false);
export const rolloutStatusTimeout: string = tl.getInput('rolloutStatusTimeout', false);

if (!namespace) {
    const kubConnection = tl.getInput('kubernetesServiceConnection', false);
    if (kubConnection) {
        namespace = tl.getEndpointDataParameter(kubConnection, 'namespace', true);
    }
}

if (!namespace) {
    tl.debug('Namespace was not supplied nor present in the endpoint; using "default" namespace instead.');
    namespace = 'default';
}

export function validateTimeoutForRolloutStatus() {
    if (rolloutStatusTimeout && !validateRegex("^\\d*$", rolloutStatusTimeout)) {
        throw new Error(tl.loc('InvalidTimeoutValue'));
    }
}

export function validateCanaryPercentage() {
    if (deploymentStrategy.toUpperCase() === canaryDeploymentHelper.CANARY_DEPLOYMENT_STRATEGY && (!validateRegex("^(([0-9]|[1-9][0-9]|100)(\\.\\d*)?)$", canaryPercentage) || parseFloat(canaryPercentage) > 100)) {
        throw new Error(tl.loc('InvalidPercentage'));
    }
}

export function validateReplicaCount() {
    if (deploymentStrategy.toUpperCase() === canaryDeploymentHelper.CANARY_DEPLOYMENT_STRATEGY && trafficSplitMethod.toUpperCase() === canaryDeploymentHelper.TRAFFIC_SPLIT_STRATEGY && !validateRegex("(^([0-9]|([1-9]\\d*))$)", baselineAndCanaryReplicas)) {
        throw new Error(tl.loc('InvalidBaselineAndCanaryReplicas'));
    }
}

function validateRegex(regex: string, testString: string) {
    var percentageRegex = new RegExp(regex);
    return percentageRegex.test(testString);
}
