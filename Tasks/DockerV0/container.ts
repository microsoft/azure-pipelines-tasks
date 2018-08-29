"use strict";

import path = require('path');
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import AuthenticationTokenProvider  from "docker-common/registryauthenticationprovider/authenticationtokenprovider"
import ACRAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import GenericAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/genericauthenticationtokenprovider"
import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

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

// Run the specified action
var action = tl.getInput("action", true);
var result = "";
/* tslint:disable:no-var-requires */
require({
    "Build an image": "./containerbuild",
    "Tag images": "./containertag",
    "Push an image": "./containerpush",
    "Push images": "./containerpush",
    "Run an image": "./containerrun",
    "Run a Docker command": "./containercommand"
}[action]).run(connection, (data) => result += data)
/* tslint:enable:no-var-requires */
.fin(function cleanup() {
    connection.close();
    tl.setVariable("DockerOutput", result);
})
.then(function success() {
    tl.setResult(tl.TaskResult.Succeeded, "");
}, function failure(err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
})
.done();