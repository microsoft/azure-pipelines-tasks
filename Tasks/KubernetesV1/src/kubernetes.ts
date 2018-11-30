"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');

import ClusterConnection from "./clusterconnection";
import * as kubectlConfigMap from "./kubernetesconfigmap";
import * as kubectlSecret from "./kubernetessecret";

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

var registryType = tl.getInput("containerRegistryType", true);
var command = tl.getInput("command", false);
const environmentVariableMaximumSize = 32766;

var kubeconfigfilePath;
if (command === "logout") {
    kubeconfigfilePath = tl.getVariable("KUBECONFIG");
}
// open kubectl connection and run the command
var connection = new ClusterConnection(kubeconfigfilePath);
try
{
    connection.open().then(  
        () => { return run(connection, command) }
    ).then(
       () =>  {
           tl.setResult(tl.TaskResult.Succeeded, "");
           if (command !== "login") {
                connection.close();
           }
       }
    ).catch((error) => {
       tl.setResult(tl.TaskResult.Failed, error.message)
       connection.close();
    });
}
catch (error)
{
    tl.setResult(tl.TaskResult.Failed, error.message);
}

async function run(clusterConnection: ClusterConnection, command: string) 
{
    var secretName = tl.getInput("secretName", false);
    var configMapName = tl.getInput("configMapName", false);

    if(secretName) {
        await kubectlSecret.run(clusterConnection, secretName);
    }

    if(configMapName) {
        await kubectlConfigMap.run(clusterConnection, configMapName);
    }

    if(command) {
        await executeKubectlCommand(clusterConnection, command);
    }  
}

// execute kubectl command
function executeKubectlCommand(clusterConnection: ClusterConnection, command: string) : any {
    var commandMap = {
        "login": "./kuberneteslogin",
        "logout": "./kuberneteslogout"
    }
    
    var commandImplementation = require("./kubernetescommand");
    if(command in commandMap) {
        commandImplementation = require(commandMap[command]);
    }

    var telemetry = {
        registryType: registryType,
        command: command
    };

    console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
        "TaskEndpointId",
        "KubernetesV1",
        JSON.stringify(telemetry));
    var result = "";
    return commandImplementation.run(clusterConnection, command, (data) => result += data)
    .fin(function cleanup() {
        var commandOutputLength = result.length;
        if (commandOutputLength > environmentVariableMaximumSize) {
            tl.warning(tl.loc("OutputVariableDataSizeExceeded", commandOutputLength, environmentVariableMaximumSize));
        } else {
            tl.setVariable('KubectlOutput', result);
        }
    });
}
