"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import { AzureAksService } from 'azure-arm-rest/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint, AKSCluster, AKSClusterAccessProfile } from 'azure-arm-rest/azureModels';

import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"
import * as helmutil from "./utils"
import fs = require('fs');
import * as commonCommandOptions from "./commoncommandoption"

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

function getKubeConfigFilePath(): string {
    var userdir = helmutil.getTaskTempDir();
    return path.join(userdir, "config");
}

function getClusterType(): any {
    var connectionType = tl.getInput("connectionType", true);
    if (connectionType === "Azure Resource Manager") {
        return require("./clusters/armkubernetescluster")
    }

    return require("./clusters/generickubernetescluster")
}

// get kubeconfig file path
async function getKubeConfigFile(): Promise<string> {
    return getClusterType().getKubeConfig().then((config) => {
        var configFilePath = getKubeConfigFilePath();
        tl.debug(tl.loc("KubeConfigFilePath", configFilePath));
        fs.writeFileSync(configFilePath, config);
        return configFilePath;
    });
}

async function run() {
    var kubectlCli: kubernetescli;
    var kubeconfigfilePath: string;
    if (requiresKubeConfig()) {
        kubeconfigfilePath = await getKubeConfigFile();
        kubectlCli = new kubernetescli(kubeconfigfilePath);
        kubectlCli.login();
    }

    try {
        runHelm(new helmcli())
    } catch (err) {
        // not throw error so that we can logout from helm and kubernetes
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
    finally {
        if (kubectlCli) {
            helmutil.deleteFile(kubeconfigfilePath);
            kubectlCli.logout();
        }
    }
}

function requiresKubeConfig() {
    var command = tl.getInput("command", true);
    var args = tl.getInput("arguments", true);
    if (command === "package"
        || command === "repo"
        || command === "lint"
        || command === "template"
        || command === "create") return false;

    if (command === "init" && args && args.indexOf("--client-only") >= 0) return false;

    return true;
}

function runHelm(helmCli: helmcli) {

    var command = tl.getInput("command", true);

    var helmCommandMap = {
        "init": "./helmcommands/helminit",
        "install": "./helmcommands/helminstall",
        "package": "./helmcommands/helmpackage",
        "upgrade": "./helmcommands/helmupgrade"
    }

    var commandImplementation = require("./helmcommands/uinotimplementedcommands");
    if (command in helmCommandMap) {
        commandImplementation = require(helmCommandMap[command]);
    }

    //set command
    helmCli.setCommand(command);

    // add arguments
    commonCommandOptions.addArguments(helmCli);
    commandImplementation.addArguments(helmCli);

    // execute command
    helmCli.execHelmCommand();
}

run().then(() => {
    // do nothing
}, (reason) => {
    tl.setResult(tl.TaskResult.Failed, reason);
});
