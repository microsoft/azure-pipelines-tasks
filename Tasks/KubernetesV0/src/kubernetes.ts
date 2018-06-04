"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');

import ClusterConnection from "./clusterconnection";
import * as kubectl from "./kubernetescommand";
import * as kubectlConfigMap from "./kubernetesconfigmap";
import * as kubectlSecret from "./kubernetessecret";

import AuthenticationTokenProvider  from "docker-common/registryauthenticationprovider/authenticationtokenprovider"
import ACRAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import GenericAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/genericauthenticationtokenprovider"
import RegistryAuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken"

tl.setResourcePath(path.join(__dirname, '..' , 'task.json'));
// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// get the registry server authentication provider 
var registryType = tl.getInput("containerRegistryType", true);
var authenticationProvider : AuthenticationTokenProvider;

if(registryType ==  "Azure Container Registry"){
    authenticationProvider = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry"));
} 
else {
    authenticationProvider = new GenericAuthenticationTokenProvider(tl.getInput("dockerRegistryEndpoint"));
}

var registryAuthenticationToken = authenticationProvider.getAuthenticationToken();

// open kubectl connection and run the command
var connection = new ClusterConnection();
try
{
    connection.open(tl.getInput("kubernetesServiceEndpoint")).then(  
        () => { return run(connection, registryAuthenticationToken) }
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

async function run(clusterConnection: ClusterConnection, registryAuthenticationToken: RegistryAuthenticationToken) 
{
    var secretName = tl.getInput("secretName", false);
    var configMapName = tl.getInput("configMapName", false);

    if(secretName) {
        await kubectlSecret.run(clusterConnection, registryAuthenticationToken, secretName);
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
    var ouputVariableName =  tl.getInput("kubectlOutput", false);  
    return kubectl.run(clusterConnection, command, (data) => result += data)
    .fin(function cleanup() {
        if(ouputVariableName) {
            tl.setVariable(ouputVariableName, result);
        }
    });
}