"use strict";

import tl = require('azure-pipelines-task-lib/task');
import kubectlutility = require("azure-pipelines-tasks-kubernetes-common-v2/kubectlutility");

export async function getKubeConfig(): Promise<string> {
    const kubernetesServiceEndpoint = tl.getInput("kubernetesServiceEndpoint", true);
    const authorizationType = tl.getEndpointDataParameter(kubernetesServiceEndpoint, 'authorizationType', true);
    
    if (!authorizationType || authorizationType === "Kubeconfig") {
        return kubectlutility.getKubeconfigForCluster(kubernetesServiceEndpoint);
    }
    else if (authorizationType === "ServiceAccount" || authorizationType === "AzureSubscription") {
        return kubectlutility.createKubeconfig(kubernetesServiceEndpoint);
    }
}