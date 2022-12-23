"use strict";

import tl = require('azure-pipelines-task-lib/task');
import { AzureAksService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AKSClusterAccessProfile, AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';

// get kubeconfig file content
async function getKubeConfigFromAKS(azureSubscriptionEndpoint: string, resourceGroup: string, clusterName: string, useClusterAdmin?: boolean) : Promise<string> {
    const azureEndpoint: AzureEndpoint = await (new AzureRMEndpoint(azureSubscriptionEndpoint)).getEndpoint();
    const aks = new AzureAksService(azureEndpoint);

    tl.debug(tl.loc("KubernetesClusterResourceGroup", clusterName, resourceGroup));

    const clusterInfo : AKSClusterAccessProfile = await aks.getAccessProfile(resourceGroup, clusterName, useClusterAdmin);
    const base64Kubeconfig = Buffer.from(clusterInfo.properties.kubeConfig, 'base64');
    return base64Kubeconfig.toString();
}

export async function getKubeConfig(): Promise<string> {
    const clusterName : string = tl.getInput("kubernetesCluster", true);
    const azureSubscriptionEndpoint : string = tl.getInput("azureSubscriptionEndpoint", true);
    const resourceGroup : string = tl.getInput("azureResourceGroup", true);
    const useClusterAdmin: boolean = tl.getBoolInput('useClusterAdmin');
    return getKubeConfigFromAKS(azureSubscriptionEndpoint, resourceGroup, clusterName, useClusterAdmin);
}
