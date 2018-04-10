"use strict";

import tl = require('vsts-task-lib/task');

export async function getKubeConfig(): Promise<string> {
    var kubernetesServiceEndpoint = tl.getInput("kubernetesServiceEndpoint", true);
    return tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'kubeconfig', false);
}