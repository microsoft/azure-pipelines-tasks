"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');

import ClusterConnection from "./clusterconnection";
import * as kubectl from "./kubernetescommand";
import * as kubectlConfigMap from "./kubernetesconfigmap";
import * as kubectlSecret from "./kubernetessecret";

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// open kubectl connection and run the command
var connection = new ClusterConnection();
try
{
    connection.open().then(  
        () => { return run(connection) }
    ).then(
       () =>  {
           tl.setResult(tl.TaskResult.Succeeded, "");
           connection.close();
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

async function run(clusterConnection: ClusterConnection) 
{
    var secretName = tl.getInput("secretName", false);
    var configMapName = tl.getInput("configMapName", false);

    if(secretName) {
        await kubectlSecret.run(clusterConnection, secretName);
    }

    if(configMapName) {
        await kubectlConfigMap.run(clusterConnection, configMapName);
    }
    
    await executeKubectlCommand(clusterConnection);  
}

// execute kubectl command
function executeKubectlCommand(clusterConnection: ClusterConnection) : any {
    var command = tl.getInput("command", true);
    var result = "";
    return kubectl.run(clusterConnection, command, (data) => result += data)
    .fin(function cleanup() {
        tl.setVariable('KubectlOutput', result);
    });
}