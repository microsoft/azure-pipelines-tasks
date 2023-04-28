"use strict";

import path = require('path');
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import ACRAuthenticationTokenProvider from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/acrauthenticationtokenprovider"
import { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";
import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

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
    command: command,
    jobId: tl.getVariable('SYSTEM_JOBID')
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