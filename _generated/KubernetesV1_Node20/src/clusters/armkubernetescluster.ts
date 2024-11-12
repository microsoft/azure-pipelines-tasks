"use strict";

import tl = require('azure-pipelines-task-lib/task');
import { AzureAksService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint, AKSClusterAccessProfile, AKSCredentialResult} from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
const USE_AKS_CREDENTIAL_API = tl.getBoolFeatureFlag('USE_AKS_CREDENTIAL_API')

// get kubeconfig file content
async function getKubeConfigFromAKS(azureSubscriptionEndpoint: string, resourceGroup: string, clusterName: string, useClusterAdmin?: boolean) : Promise<string> {
    var azureEndpoint: AzureEndpoint = await (new AzureRMEndpoint(azureSubscriptionEndpoint)).getEndpoint();
    var aks = new AzureAksService(azureEndpoint);
    tl.debug(`USE_AKS_CREDENTIAL_API Feature flag status is ${USE_AKS_CREDENTIAL_API}`);
    tl.debug(tl.loc("KubernetesClusterResourceGroup", clusterName, resourceGroup));
    let base64Kubeconfig;
    if (USE_AKS_CREDENTIAL_API) {
        let clusterInfo : AKSCredentialResult = await aks.getClusterCredential(resourceGroup, clusterName, useClusterAdmin);
        base64Kubeconfig = Buffer.from(clusterInfo.value, 'base64');
    } else {
        let clusterInfo : AKSClusterAccessProfile = await aks.getAccessProfile(resourceGroup, clusterName, useClusterAdmin);
        base64Kubeconfig = Buffer.from(clusterInfo.properties.kubeConfig, 'base64');
    }
    return base64Kubeconfig.toString();
}

export async function getKubeConfig(): Promise<string> {
    var azureSubscriptionEndpoint : string = tl.getInput("azureSubscriptionEndpoint", true);
    var resourceGroup : string = tl.getInput("azureResourceGroup", true);
    var clusterName : string = tl.getInput("kubernetesCluster", true);
    var useClusterAdmin: boolean = tl.getBoolInput('useClusterAdmin');
    return getKubeConfigFromAKS(azureSubscriptionEndpoint, resourceGroup, clusterName, useClusterAdmin);
}
