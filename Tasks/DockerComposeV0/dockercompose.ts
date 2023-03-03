"use strict";

import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as DockerComposeUtils from "./dockercomposeutils";

import ACRAuthenticationTokenProvider from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import DockerComposeConnection from "./dockercomposeconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";

import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

var cwd = tl.getInput("cwd");

// Change to any specified working directory
tl.cd(cwd);

// get the registry server authentication provider 
var registryType = tl.getInput("containerregistrytype", true);
var registryAuthenticationToken;

if (registryType == "Azure Container Registry") {
    registryAuthenticationToken = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry")).getAuthenticationToken();
}
else {
    registryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(tl.getInput("dockerRegistryEndpoint"))
}

var dockerComposeFile = tl.getInput("dockerComposeFile", true);
var nopIfNoDockerComposeFile = tl.getBoolInput("nopIfNoDockerComposeFile");
var dockerFile = DockerComposeUtils.findDockerFile(dockerComposeFile, cwd);
if (nopIfNoDockerComposeFile && !tl.exist(dockerFile)) {
    console.log("No Docker Compose file matching " + dockerComposeFile + " was found.");
    tl.setResult(tl.TaskResult.Succeeded, "");
} else {    
    let resultPaths = "";

    // Connect to any specified Docker host and/or registry 
    var connection = new DockerComposeConnection();
    connection.open(tl.getInput("dockerHostEndpoint"), registryAuthenticationToken)
        .then(function runAction() {
            // Run the specified action
            var action = tl.getInput("action", true).toLowerCase();
            var telemetry = {
                registryType: registryType,
                command: action !== "Run a Docker Compose command" ? action : tl.getInput("dockerComposeCommand", true)
            };

            /* tslint:disable:no-var-requires */
            return require({
                "build services": "./dockercomposebuild",
                "push services": "./dockercomposepush",
                "run services": "./dockercomposeup",
                "run a specific service": "./dockercomposerun",
                "lock services": "./dockercomposelock",
                "write service image digests": "./dockercomposedigests",
                "combine configuration": "./dockercomposeconfig",
                "run a docker compose command": "./dockercomposecommand"
            }[action]).run(connection, (pathToResult) => {
                resultPaths += `${pathToResult}\n`;    
            });
            /* tslint:enable:no-var-requires */
        })
        .fin(function cleanup() {
            connection.close();
        })
        .then(function success() {
            tl.setVariable("DockerComposeOutput", resultPaths);
            tl.setResult(tl.TaskResult.Succeeded, "");
        }, function failure(err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        })
        .done();
}