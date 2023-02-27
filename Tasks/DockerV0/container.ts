"use strict";

import path = require('path');
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import ACRAuthenticationTokenProvider from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/acrauthenticationtokenprovider";
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// get the registry server authentication provider 
var containerRegistryType = tl.getInput("containerregistrytype", true);
const environmentVariableMaximumSize = 32766;

var registryAuthenticationToken;
if (containerRegistryType == "Azure Container Registry") {
    registryAuthenticationToken = new ACRAuthenticationTokenProvider(tl.getInput("azureSubscriptionEndpoint"), tl.getInput("azureContainerRegistry")).getAuthenticationToken();
}
else {
    let endpointId = tl.getInput("dockerRegistryEndpoint");
    registryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId);
}

// Connect to any specified container host and/or registry 
var connection = new ContainerConnection();
connection.open(tl.getInput("dockerHostEndpoint"), registryAuthenticationToken);

// Run the specified action
var action = tl.getInput("action", true).toLowerCase();
let command = "";

if(action !== "run a docker command") {
    command = action;
}
else {
    let customCommand = tl.getInput("customCommand", true);

    // sanitize the custom command parameters to log just the action
    let commandTokens = customCommand.split(" ");
    if(commandTokens.length > 0) {
        for(let index = 0; index < commandTokens.length; index ++) {
            // Stop reading tokens when we see any that starts with a special character
            if(/^[a-z0-9A-Z]/i.test(commandTokens[index])) {
                command = command + commandTokens[index] + " ";
            }
            else{
                break;
            }
        }
        command = command.trim();
    }
    else {
        command = "run a docker command"
    }
}

var result = "";
var telemetry = {
    registryType: containerRegistryType,
    command: command,
    jobId: tl.getVariable('SYSTEM_JOBID')
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "DockerV0",
    JSON.stringify(telemetry));

/* tslint:disable:no-var-requires */
require({
    "build an image": "./containerbuild",
    "tag images": "./containertag",
    "push an image": "./containerpush",
    "push images": "./containerpush",
    "run an image": "./containerrun",
    "run a docker command": "./containercommand"
}[action]).run(connection, (data) => result += data)
/* tslint:enable:no-var-requires */
.fin(function cleanup() {
    connection.close();
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