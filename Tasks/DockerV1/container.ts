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
var registryType = tl.getInput("containerregistrytype", true);
var authenticationProvider : AuthenticationTokenProvider;

if(registryType ==  "Azure Container Registry"){
    authenticationProvider = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry"));
} 
else {
    authenticationProvider = new GenericAuthenticationTokenProvider(tl.getInput("dockerRegistryEndpoint"));
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
    registryType: registryType,
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
    tl.setVariable("DockerOutput", result);
    tl.setResult(tl.TaskResult.Succeeded, "");
}, function failure(err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
})
.done();