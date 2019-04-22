"use strict";

import path = require('path');
import * as tl from "vsts-task-lib/task";
import RegistryAuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from 'docker-common/containerconnection';
import { getDockerRegistryEndpointAuthenticationToken } from "docker-common/registryauthenticationprovider/registryauthenticationtoken";

tl.setResourcePath(path.join(__dirname, 'task.json'));

let endpointId = tl.getInput("containerRegistry");
let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId);

// Take the specified command
let command = tl.getInput("command", true).toLowerCase();
let isLogout = (command === "logout");

// Connect to any specified container registry
let connection = new ContainerConnection();
connection.open(null, registryAuthenticationToken, true, isLogout);

let dockerCommandMap = {
    "buildandpush": "./dockerbuildandpush",
    "build": "./dockerbuild",
    "push": "./dockerpush",
    "login": "./dockerlogin",
    "logout": "./dockerlogout"
}

let telemetry = {
    command: command
};

console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
    "TaskEndpointId",
    "DockerV2",
    JSON.stringify(telemetry));

/* tslint:disable:no-var-requires */
let commandImplementation = require("./dockercommand");
if (command in dockerCommandMap) {
    commandImplementation = require(dockerCommandMap[command]);
}

let resultPaths = "";
commandImplementation.run(connection, (pathToResult) => {
    resultPaths += pathToResult;    
})
/* tslint:enable:no-var-requires */
.fin(function cleanup() {
    if (command !== "login") {
        connection.close(true, command);
    }
})
.then(function success() {
    tl.setVariable("DockerOutput", resultPaths);
    tl.setResult(tl.TaskResult.Succeeded, "");
}, function failure(err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
})
.done();