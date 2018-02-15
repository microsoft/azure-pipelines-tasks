"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as DockerComposeUtils from "./dockercomposeutils";

import AuthenticationTokenProvider  from "docker-common/registryauthenticationprovider/authenticationtokenprovider"
import ACRAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import DockerComposeConnection from "./dockercomposeconnection";
import GenericAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/genericauthenticationtokenprovider"

import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// get the registry server authentication provider 
var registryType = tl.getInput("containerregistrytype", true);
var authenticationProvider: AuthenticationTokenProvider;

if (registryType == "Azure Container Registry") {
    authenticationProvider = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry"));
}
else {
    authenticationProvider = new GenericAuthenticationTokenProvider(tl.getInput("dockerRegistryEndpoint"));
}

var registryAuthenticationToken = authenticationProvider.getAuthenticationToken();

var dockerComposeFile = tl.getInput("dockerComposeFile", true);
var nopIfNoDockerComposeFile = tl.getBoolInput("nopIfNoDockerComposeFile");
var dockerFile = DockerComposeUtils.findDockerFile(dockerComposeFile);
if (nopIfNoDockerComposeFile && !tl.exist(dockerFile)) {
    console.log("No Docker Compose file matching " + dockerComposeFile + " was found.");
    tl.setResult(tl.TaskResult.Succeeded, "");
} else {
    // Connect to any specified Docker host and/or registry 
    var connection = new DockerComposeConnection();
    connection.open(tl.getInput("dockerHostEndpoint"), registryAuthenticationToken)
        .then(function runAction() {
            // Run the specified action
            var action = tl.getInput("action", true);
            /* tslint:disable:no-var-requires */
            return require({
                "Build services": "./dockercomposebuild",
                "Push services": "./dockercomposepush",
                "Run services": "./dockercomposeup",
                "Run a specific service": "./dockercomposerun",
                "Lock services": "./dockercomposelock",
                "Write service image digests": "./dockercomposedigests",
                "Combine configuration": "./dockercomposeconfig",
                "Run a Docker Compose command": "./dockercomposecommand"
            }[action]).run(connection);
            /* tslint:enable:no-var-requires */
        })
        .fin(function cleanup() {
            connection.close();
        })
        .then(function success() {
            tl.setResult(tl.TaskResult.Succeeded, "");
        }, function failure(err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        })
        .done();
}