"use strict";

import tl = require('vsts-task-lib/task');
import { AzureAksService } from 'azure-arm-rest/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint, AKSCluster, AKSClusterAccessProfile} from 'azure-arm-rest/azureModels';

function extractResourceGroup(id: string): string {
    var array = id.split('/');
    return array[array.findIndex(str=> str.toUpperCase() === "resourceGroups".toUpperCase()) + 1];
}

// Get cluster info
async function getCluster(aks: AzureAksService, clusterName: string) : Promise<AKSCluster> {
    var temp: AKSCluster[] = await aks.list();
    var cluster = temp.find((element) => {
        return element.name.toLowerCase() === clusterName.toLowerCase();
    });

    if(!cluster) {
        tl.error(tl.loc("ClusterNotFound", clusterName)); 
        throw new Error(tl.loc("ClusterNotFound", clusterName));
    }

    tl.debug(tl.loc("KubernetesClusterInfo", cluster.id, cluster.properties.kubernetesVersion, cluster.properties.provisioningState));
    if(cluster.properties.provisioningState.toLowerCase() !== "succeeded") {
        tl.warning(tl.loc("ClusterNotProvisioned", clusterName, cluster.properties.provisioningState));        
    }
    return cluster;
}

// get kubeconfig file content
async function getKubeConfigFromAKS(azureSubscriptionEndpoint: string, clusterName: string) : Promise<string> {
    var azureEndpoint: AzureEndpoint = await (new AzureRMEndpoint(azureSubscriptionEndpoint)).getEndpoint();
    var aks = new AzureAksService(azureEndpoint);
    var cluster = await getCluster(aks, clusterName);
    var resourceGroup = extractResourceGroup(cluster.id);
    tl.debug(tl.loc("KubernetesClusterResourceGroup", cluster.name, resourceGroup));

    var clusterInfo : AKSClusterAccessProfile = await aks.getAccessProfile(resourceGroup, clusterName);
    var Base64 = require('js-base64').Base64;
    return Base64.decode(clusterInfo.properties.kubeConfig);
}

export async function getKubeConfig(): Promise<string> {
    var clusterName : string = tl.getInput("kubernetesCluster", true);
    var azureSubscriptionEndpoint : string = tl.getInput("azureSubscriptionEndpoint", true);
    return getKubeConfigFromAKS(azureSubscriptionEndpoint, clusterName);
}
