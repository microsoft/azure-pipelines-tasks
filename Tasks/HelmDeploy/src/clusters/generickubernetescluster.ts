"use strict";

import tl = require('vsts-task-lib/task');

export async function getKubeConfig(): Promise<string> {
    var kubernetesServiceEndpoint = tl.getInput("kubernetesServiceEndpoint", false);

    if(!kubernetesServiceEndpoint) {
        tl.debug("KubernetesEndpointNotSpecified");
        return undefined;
    }

    return tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'kubeconfig', false);
}