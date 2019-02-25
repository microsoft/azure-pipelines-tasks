"use strict";

import path = require('path');
import * as tl from "vsts-task-lib/task";
import GenericAuthenticationTokenProvider from "docker-common/registryauthenticationprovider/genericauthenticationtokenprovider";
import RegistryAuthenticationToken from "docker-common/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from 'docker-common/containerconnection';
import Q = require('q');

tl.setResourcePath(path.join(__dirname, 'task.json'));

const environmentVariableMaximumSize = 32766;

let containerRegisitry = tl.getInput("containerRegistry");
let authenticationProvider = new GenericAuthenticationTokenProvider(containerRegisitry);        
let registryAuthenticationToken = authenticationProvider.getAuthenticationToken();

// Connect to any specified container registry
let connection = new ContainerConnection();
connection.open(null, registryAuthenticationToken, true);

// Take the specified command
let command = tl.getInput("command", true).toLowerCase();

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

let result = "";
commandImplementation.run(connection, (pathToResult) => {
    result += pathToResult;
    
})
/* tslint:enable:no-var-requires */
.fin(function cleanup() {
    if (command !== "login") {
        connection.close();
    }
})
.then(function success() {
    let commandOutputLength = result.length;
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