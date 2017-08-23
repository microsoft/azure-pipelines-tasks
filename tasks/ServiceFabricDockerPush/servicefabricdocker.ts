"use strict";

import path = require('path');
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import AuthenticationTokenProvider  from "docker-common/registryauthenticationprovider/authenticationtokenprovider"
import ACRAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import GenericAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/genericauthenticationtokenprovider"
import * as push from "./containerpush";

tl.setResourcePath(path.join(__dirname, 'task.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// get the registry server authentication provider 
let registryType = tl.getInput("containerregistrytype", true);
let authenticationProvider : AuthenticationTokenProvider;

if (registryType === "Azure Container Registry") {
    authenticationProvider = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry"));
} 
else {
    authenticationProvider = new GenericAuthenticationTokenProvider(tl.getInput("dockerRegistryEndpoint"));
}

let registryAuthenticationToken = authenticationProvider.getAuthenticationToken();

// Connect to any specified container host and/or registry 
let connection = new ContainerConnection();
connection.open(tl.getInput("dockerHostEndpoint"), registryAuthenticationToken);

/* tslint:disable:no-var-requires */
push.run(connection)
    /* tslint:enable:no-var-requires */
    .fin(function cleanup() {
        connection.close();
    })
    .then(function success() {
        tl.setResult(tl.TaskResult.Succeeded, "");
    }, function failure(err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    })
    .done();