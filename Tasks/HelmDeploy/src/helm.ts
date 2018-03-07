"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import { AzureAksService } from 'azure-arm-rest/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint, AKSCluster, AKSClusterAccessProfile} from 'azure-arm-rest/azureModels';

import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"
import * as helmutil from "./utils"
import fs = require('fs');

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

function extractResourceGroup(id: string): string {
        var array = id.split('/');
        return array[array.findIndex(str=> str.toUpperCase() === "resourceGroups".toUpperCase()) + 1];
}

function getKubeConfigFilePath(): string {
    var userdir = helmutil.getTaskTempDir();
    return path.join(userdir, "config");
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
async function getKubeConfig(azureSubscriptionEndpoint: string, clusterName: string) : Promise<string> {
    var azureEndpoint: AzureEndpoint = await (new AzureRMEndpoint(azureSubscriptionEndpoint)).getEndpoint();
    var aks = new AzureAksService(azureEndpoint);
    var cluster = await getCluster(aks, clusterName);
    var resourceGroup = extractResourceGroup(cluster.id);
    tl.debug(tl.loc("KubernetesClusterResourceGroup", cluster.name, resourceGroup));

    var clusterInfo : AKSClusterAccessProfile = await aks.getAccessProfile(resourceGroup, clusterName);
    var Base64 = require('js-base64').Base64;
    return Base64.decode(clusterInfo.properties.kubeConfig);
}

// get kubeconfig file path
async function getKubeConfigFile(azureSubscriptionEndpoint: string, clusterName: string): Promise<string> {
    return getKubeConfig(azureSubscriptionEndpoint, clusterName).then((config) => {
        var configFilePath = getKubeConfigFilePath();
        tl.debug(tl.loc("KubeConfigFilePath", configFilePath));
        fs.writeFileSync(configFilePath, config);
        return configFilePath;
    });
}

//confinure kubernetes
function configureKubernetes(kubeconfigfilePath: string) :  kubernetescli {
    var kubectlCli = new kubernetescli(kubeconfigfilePath);
    if (!kubectlCli.IsInstalled()) {
        kubectlCli.logout();
        throw new Error(tl.loc("KubernetesNotFound"));
    }

    return kubectlCli;
}

//configure helm
function configureHelm() : helmcli {
    var helmCli = new helmcli();
    if (!helmCli.IsInstalled()) {
       throw new Error(tl.loc("HelmNotFound"));
    }
    return helmCli;
}

async function run() {
    var clusterName : string = tl.getInput("kubernetesCluster", true);
    var azureSubscriptionEndpoint : string = tl.getInput("azureSubscriptionEndpoint", true);
    var kubeconfigfilePath = await getKubeConfigFile(azureSubscriptionEndpoint, clusterName);
    var kubectlCli: kubernetescli = configureKubernetes(kubeconfigfilePath);
    var helmCli : helmcli = configureHelm();
    kubectlCli.login();
    helmCli.login();
    
    try {
        runHelm(helmCli)
    } catch(err) {
        // not throw error so that we can logout from helm and kubernetes
        tl.setResult(tl.TaskResult.Failed, err.message);
    }

    if(kubectlCli) {
        kubectlCli.logout();
    }

    if(helmCli) {
        helmCli.logout();
    }
}

function runHelm(helmCli: helmcli) {
    helmCli.setCommand(tl.getInput("command", true));
    helmCli.setArgument(tl.getInput("arguments", false));    
    helmCli.execHelmCommand();
}

run().then(()=>{
 // do nothing
}, (reason)=> {
     tl.setResult(tl.TaskResult.Failed, reason);
});
