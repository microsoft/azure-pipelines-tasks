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
import * as commonCommandOptions from "./commoncommandoption"
import * as tls from "./tls"

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

// get kubeconfig file path
async function getKubeConfigFile(): Promise<string> {
    return getClusterType().getKubeConfig().then((config) => {
        var configFilePath = getKubeConfigFilePath();
        tl.debug(tl.loc("KubeConfigFilePath", configFilePath));
        fs.writeFileSync(configFilePath, config);
        return configFilePath;
    });
}

//configure kubernetes
function configureKubernetes(kubeconfigfilePath: string) :  kubernetescli {
    var kubectlCli = new kubernetescli(kubeconfigfilePath);
    if (!kubectlCli.IsInstalled()) {
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
    var kubeconfigfilePath = await getKubeConfigFile();
    var kubectlCli: kubernetescli = configureKubernetes(kubeconfigfilePath);
    var helmCli : helmcli = configureHelm();
    kubectlCli.login();
    helmCli.login();

    try {
        await runHelm(helmCli)
    } catch(err) {
        // not throw error so that we can logout from helm and kubernetes
        tl.setResult(tl.TaskResult.Failed, err.message);
    } 
    finally {
        helmutil.deleteFile(kubeconfigfilePath);
        kubectlCli.logout();
        helmCli.logout();
    }
}

async function runHelm(helmCli: helmcli) {

    var command = tl.getInput("command", true);
    
    var helmCommandMap ={
        "init":"./helmcommands/helminit",
        "install":"./helmcommands/helminstall"
    }    

    var commandImplementation = require("./helmcommands/uinotimplementedcommands");
    if(command in helmCommandMap) {
        commandImplementation = require(helmCommandMap[command]);
    }

    //set command
    helmCli.setCommand(command);

    // enable tls
    if(tls.isTlsEnabled()) {
        var cacertPathPath = await tls.downloadSecuredFile(tl.getInput("cacert", true));
        var certificatePath = await tls.downloadSecuredFile(tl.getInput("certificate", true));
        var keyPath = await tls.downloadSecuredFile(tl.getInput("key", true));

        tls.addArguments(helmCli, cacertPathPath, certificatePath, keyPath);
    }

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
