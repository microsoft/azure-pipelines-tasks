'use strict';

import * as tl from 'azure-pipelines-task-lib/task';

export let namespace: string = tl.getInput('namespace', false);
export const containers: string[] = tl.getDelimitedInput('containers', '\n');
export const imagePullSecrets: string[] = tl.getDelimitedInput('imagePullSecrets', '\n');
export const manifests = tl.getDelimitedInput('manifests', '\n');
export const canaryPercentage: string = tl.getInput('percentage');
export const deploymentStrategy: string = tl.getInput('strategy', false);
export const args: string = tl.getInput('arguments', false);
export const secretArguments: string = tl.getInput('secretArguments', false) || '';
export const secretType: string = tl.getInput('secretType', false);
export const secretName: string = tl.getInput('secretName', false);
export const dockerRegistryEndpoint: string = tl.getInput('dockerRegistryEndpoint', false);

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