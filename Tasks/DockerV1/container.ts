"use strict";

import path = require('path');
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import AuthenticationTokenProvider  from "docker-common/registryauthenticationprovider/authenticationtokenprovider"
import ACRAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import GenericAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/genericauthenticationtokenprovider"
import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

// get the registry server authentication provider 
var containerRegistryType = tl.getInput("containerregistrytype", true);
var authenticationProvider : AuthenticationTokenProvider;
const environmentVariableMaximumSize = 32766;

if(containerRegistryType ==  "Azure Container Registry"){
    authenticationProvider = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry"));
} 
else {
    let endpointId = tl.getInput("dockerRegistryEndpoint");
    const registryType: string = tl.getEndpointDataParameter(endpointId, "registrytype", true);
    if(registryType ==  "ACR"){
        const loginServer = tl.getEndpointAuthorizationParameter(endpointId, "loginServer", false);
        authenticationProvider = new ACRAuthenticationTokenProvider(endpointId, loginServer);
    }
    else {
        authenticationProvider = new GenericAuthenticationTokenProvider(tl.getInput("dockerRegistryEndpoint"));
    }
}

var registryAuthenticationToken = authenticationProvider.getAuthenticationToken();

// Connect to any specified container host and/or registry 
var connection = new ContainerConnection();
connection.open(tl.getInput("dockerHostEndpoint"), registryAuthenticationToken);

// Run the specified command
var command = tl.getInput("command", true).toLowerCase();
/* tslint:disable:no-var-requires */

var dockerCommandMap = {
    "build an image": "./containerbuild",
    "build": "./containerbuild",
    "tag image": "./containertag",
    "tag": "./containertag",
    "push an image": "./containerpush",
    "push": "./containerpush",
    "run an image": "./containerrun",
    "run": "./containerrun",
    "login": "./dockerlogin",
    "logout": "./dockerlogout"
}

var telemetry = {
    registryType: containerRegistryType,
    command: command
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "DockerV1",
    JSON.stringify(telemetry));

var commandImplementation = require("./containercommand");
if (command in dockerCommandMap) {
    commandImplementation = require(dockerCommandMap[command]);
}

var result = "";
commandImplementation.run(connection, (data) => result += data)
/* tslint:enable:no-var-requires */
.fin(function cleanup() {
    if (command !== "login") {
        connection.close();
    }
})
.then(function success() {
    var commandOutputLength = result.length;
    if (commandOutputLength > environmentVariableMaximumSize) {
        tl.warning(tl.loc('OutputVariableDataSizeExceeded', commandOutputLength, environmentVariableMaximumSize));
    } else {
        tl.setVariable("DockerOutput", result);
    }

    tl.setResult(tl.TaskResult.Succeeded, "");
}, function failure(err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
})
.done();