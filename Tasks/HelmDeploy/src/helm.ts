"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');

import azurecli from "./azurecli";
import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

var azCli = new azurecli(tl.getInput("azureSubscriptionEndpoint", true));

var kubectlCli = new kubernetescli();

if (!azCli.IsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("AzureSDKNotFound"));
}



if (!kubectlCli.IsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("KubernetesNotFound"));
}

azCli.login();

var kubeConfigPath = azCli.getCredential(azCli.getResourceGroup(tl.getInput("kubernetesCluster", true)), tl.getInput("kubernetesCluster", true));
azCli.logout();

var helmCli = new helmcli(kubeConfigPath);
if (!helmCli.IsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("HelmNotFound"));
}

tl.setVariable("KUBECONFIG", kubeConfigPath);

helmCli.setCommand(tl.getInput("command", true));
//helmCli.setArgument();
helmCli.execHelmCommand();
