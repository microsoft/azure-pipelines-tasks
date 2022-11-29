"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import ClusterConnection from "./clusterconnection";
import * as kubectl from "./kubernetescommand";
import * as kubectlConfigMap from "./kubernetesconfigmap";
import * as kubectlSecret from "./kubernetessecret";

import ACRAuthenticationTokenProvider from "azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/acrauthenticationtokenprovider"
import RegistryAuthenticationToken from "azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/registryauthenticationtoken"
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// get the registry server authentication provider 
var registryType = tl.getInput("containerRegistryType", true);
console.log(registryType);
const environmentVariableMaximumSize = 32766;
// open kubectl connection and run the command
var connection = new ClusterConnection();
console.log("start");
try
{
    connection.open(tl.getInput("kubernetesServiceEndpoint")).then(  
        () => { return run(connection) }
    ).then(
       () =>  {
           console.log("done");
           tl.setResult(tl.TaskResult.Succeeded, "");
           connection.close();
           console.log("success");
       }
    ).catch((error) => {
       console.log("failure1");
       tl.setResult(tl.TaskResult.Failed, error.message)
       connection.close();
    });
}
catch (error)
{
    console.log("failure2");
    tl.setResult(tl.TaskResult.Failed, error.message);
}

async function run(clusterConnection: ClusterConnection)
{
    let registryAuthenticationToken: RegistryAuthenticationToken;
    if ( registryType === 'Azure Container Registry'){
        registryAuthenticationToken = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry")).getAuthenticationToken();
    } else {
        registryAuthenticationToken = await getDockerRegistryEndpointAuthenticationToken(tl.getInput("dockerRegistryEndpoint"));
    }
    console.log("Auth Token:", registryAuthenticationToken);
    var secretName = tl.getInput("secretName", false);
    var configMapName = tl.getInput("configMapName", false);
    var command = tl.getInput("command", false);

    console.log(secretName,configMapName,command);
    if(secretName) {
        console.log("secret start");
        await kubectlSecret.run(clusterConnection, registryAuthenticationToken, secretName);
        console.log("secret end");
    }

    if(configMapName) {
        console.log("config start");
        await kubectlConfigMap.run(clusterConnection, configMapName);
        console.log("config end");
    }

    if (command) {
        console.log("command start");
        await executeKubectlCommand(clusterConnection, command);
        console.log("command end");
    }
}

// execute kubectl command
function executeKubectlCommand(clusterConnection: ClusterConnection, command: string) : any {
    var result = "";
    var outputVariableName =  tl.getInput("kubectlOutput", false);  
    var telemetry = {
        registryType: registryType,
        command: command,
        jobId: tl.getVariable('SYSTEM_JOBID')
    };

    console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
        "TaskEndpointId",
        "KubernetesV0",
        JSON.stringify(telemetry));
    return kubectl.run(clusterConnection, command, (data) => result += data)
    .fin(function cleanup() {
        if(outputVariableName) {
            var commandOutputLength = result.length;
            if (commandOutputLength > environmentVariableMaximumSize) {
                tl.warning(tl.loc('OutputVariableDataSizeExceeded', commandOutputLength, environmentVariableMaximumSize));
            } else {
                tl.setVariable(outputVariableName, result);
            }
        }
    });
}