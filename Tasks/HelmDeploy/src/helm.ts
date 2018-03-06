"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import { AzureAksService } from 'azure-arm-rest/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint,AKSCluster, AKSClusterUser} from 'azure-arm-rest/azureModels';

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


async function getKubeConfig() {
    var azureEndpoint: AzureEndpoint = await (new AzureRMEndpoint(tl.getInput("azureSubscriptionEndpoint", true))).getEndpoint();
    var aks = new AzureAksService(azureEndpoint);
    var temp: AKSCluster[] = await aks.list();
    var cluster = temp.find((element) => {
        return element.name === tl.getInput("kubernetesCluster", true);
    });

    var resourceGroup = extractResourceGroup(cluster.id);

    var tempConfig : AKSClusterUser= await aks.GetKubeConfigFile(resourceGroup, tl.getInput("kubernetesCluster", true));
    //return btoa(tempConfig.properties.kubeConfig);
    var Base64 = require('js-base64').Base64;
    return Base64.decode(tempConfig.properties.kubeConfig);
}


getKubeConfig().then((config)=> {
     console.log(config);
     var configFilePath = getKubeConfigFilePath();
     fs.writeFileSync(configFilePath,config);
     var kubectlCli = new kubernetescli(configFilePath);

     if (!kubectlCli.IsInstalled()) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("KubernetesNotFound"));
     }
     run();
});


function run() {
    var helmCli = new helmcli();
    if (!helmCli.IsInstalled()) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("HelmNotFound"));
    }

    helmCli.setCommand(tl.getInput("command", true));
    helmCli.setArgument(tl.getInput("arguments", false));    
    helmCli.execHelmCommand();
}


