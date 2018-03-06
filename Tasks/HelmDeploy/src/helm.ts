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
    var userdir = helmutil.getNewUserDirPath();
    return path.join(userdir, "configFromAPI");
}

var clusterName : string = tl.getInput("kubernetesCluster", true);

async function getCluster(aks: AzureAksService, clusterName: string) : Promise<AKSCluster> {
    var temp: AKSCluster[] = await aks.list();
    var cluster = temp.find((element) => {
        return element.name === clusterName;
    });

    if(!cluster) {
        tl.error(tl.loc("ClusterNotFound", clusterName)); 
        throw new Error(tl.loc("ClusterNotFound", clusterName));
    }

    tl.debug(tl.loc("KubernetesClusterInfo", cluster.id, cluster.properties.kubernetesVersion, cluster.properties.provisioningState));
    if(cluster.properties.provisioningState.toLowerCase() !== "succeeded") {
        tl.warning(tl.loc("ClusterNotProvisioned"));        
    }
    return cluster;
}

async function getKubeConfig() {
    var azureEndpoint: AzureEndpoint = await (new AzureRMEndpoint(tl.getInput("azureSubscriptionEndpoint", true))).getEndpoint();
    var aks = new AzureAksService(azureEndpoint);
    var cluster = await getCluster(aks, clusterName);
    var resourceGroup = extractResourceGroup(cluster.id);
    tl.debug(tl.loc("KubernetesClusterResourceGroup", cluster.name, resourceGroup));

    var clusterInfo : AKSClusterAccessProfile = await aks.getKubeConfigFile(resourceGroup, clusterName);
    var Base64 = require('js-base64').Base64;
    return Base64.decode(clusterInfo.properties.kubeConfig);
}


getKubeConfig().then((config)=> {
    try {
        var configFilePath = getKubeConfigFilePath();
        tl.debug(tl.loc("KubeConfigFilePath", configFilePath));
        fs.writeFileSync(configFilePath,config);
        var kubectlCli = new kubernetescli(configFilePath);

        if (!kubectlCli.IsInstalled()) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("KubernetesNotFound"));
        }

        runHelm();
    } catch(err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }

}, (reason)=>{
     tl.setResult(tl.TaskResult.Failed, tl.loc("CantDownloadKubeConfig", clusterName, reason));
});


function runHelm() {
    var helmCli = new helmcli();
    if (!helmCli.IsInstalled()) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("HelmNotFound"));
    }

    helmCli.setCommand(tl.getInput("command", true));
    helmCli.setArgument(tl.getInput("arguments", false));    
    helmCli.execHelmCommand();
}


