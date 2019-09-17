"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import { AzureAksService } from 'azure-arm-rest-v2/azure-arm-aks-service';
import { AzureRMEndpoint } from 'azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint, AKSCluster, AKSClusterAccessProfile} from 'azure-arm-rest-v2/azureModels';

import helmcli from "./helmcli";
import kubernetescli from "./kubernetescli"
import * as helmutil from "./utils"
import fs = require('fs');
import * as commonCommandOptions from "./commoncommandoption"

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));

function getKubeConfigFilePath(): string {
    var userdir = helmutil.getTaskTempDir();
    return path.join(userdir, "config");
}

function getClusterType(): any {
    var connectionType = tl.getInput("connectionType", true);
    if(connectionType === "Azure Resource Manager") {
        return require("./clusters/armkubernetescluster")  
    }
    
    return require("./clusters/generickubernetescluster")
}

function isKubConfigSetupRequired(command: string): boolean {
    var connectionType = tl.getInput("connectionType", true);
    return command !== "package" && connectionType !== "None";
}

function isKubConfigLogoutRequired(command: string): boolean {
    var connectionType = tl.getInput("connectionType", true);
    return command !== "package" && command !== "login" && connectionType !== "None";
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
    var command = tl.getInput("command", true).toLowerCase();
    var isKubConfigRequired = isKubConfigSetupRequired(command);
    var kubectlCli: kubernetescli;
    if (isKubConfigRequired) {
        var kubeconfigfilePath = command === "logout" ? tl.getVariable("KUBECONFIG") : await getKubeConfigFile();
        kubectlCli = new kubernetescli(kubeconfigfilePath);
        kubectlCli.login();
    }

    var helmCli : helmcli = new helmcli();
    helmCli.login();
    var connectionType = tl.getInput("connectionType", true);
    var telemetry = {
        connectionType: connectionType,
        command: command,
        jobId: tl.getVariable('SYSTEM_JOBID')
    };

    console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
        "TaskEndpointId",
        "HelmDeployV0",
        JSON.stringify(telemetry));

    try {
        switch (command){
            case "login":
                kubectlCli.setKubeConfigEnvVariable();
                break;
            case "logout":
                kubectlCli.unsetKubeConfigEnvVariable();
                break;
            default:
                runHelm(helmCli, command);
        }
    } catch(err) {
        // not throw error so that we can logout from helm and kubernetes
        tl.setResult(tl.TaskResult.Failed, err.message);
    } 
    finally {
        if (isKubConfigLogoutRequired(command)) {
            kubectlCli.logout();
        }

        helmCli.logout();
    }
}

function runHelm(helmCli: helmcli, command: string) {
    var helmCommandMap ={
        "init": "./helmcommands/helminit",
        "install": "./helmcommands/helminstall",
        "package": "./helmcommands/helmpackage",
        "upgrade": "./helmcommands/helmupgrade"
    }    

    var commandImplementation = require("./helmcommands/uinotimplementedcommands");
    if(command in helmCommandMap) {
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

run().then(()=>{
 // do nothing
}, (reason)=> {
     tl.setResult(tl.TaskResult.Failed, reason);
});
