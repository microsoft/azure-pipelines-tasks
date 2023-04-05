"use strict";

import path = require('path');
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import RegistryAuthenticationToken, { getDockerRegistryEndpointAuthenticationToken } from "azure-pipelines-tasks-docker-common/registryauthenticationprovider/registryauthenticationtoken";

tl.setResourcePath(path.join(__dirname, 'task.json'));
let registryAuthenticationToken: RegistryAuthenticationToken;
let endpointId = tl.getInput("containerRegistry");

async function getToken() {
    registryAuthenticationToken = await getDockerRegistryEndpointAuthenticationToken(endpointId);
}

getToken().then((val) => {
    // Take the specified command
    let command = tl.getInput("command", true).toLowerCase();
    let isLogout = (command === "logout");
    let isLogin = (command === "login");
    const isDockerRequired = !isLogin && !isLogout;

    // Connect to any specified container registry
    let connection = new ContainerConnection(isDockerRequired);
    connection.open(null, registryAuthenticationToken, true, isLogout);

    let dockerCommandMap = {
        "buildandpush": "./dockerbuildandpush",
        "build": "./dockerbuild",
        "push": "./dockerpush",
        "login": "./dockerlogin",
        "logout": "./dockerlogout",
        "start": "./dockerlifecycle",
        "stop": "./dockerlifecycle"
    }

    let authType: string;
    try {
        tl.debug("Attempting to get endpoint authorization scheme...");
        authType = tl.getEndpointAuthorizationScheme(endpointId, false);
    } catch (error) {
        tl.debug("Failed to get endpoint authorization scheme.")
    }
    if (!authType) {
        try {
            tl.debug("Attempting to get endpoint authorization scheme as an authorization parameter...");
            authType = tl.getEndpointAuthorizationParameter(endpointId, "scheme", false);
        } catch (error) {
            tl.debug("Failed to get endpoint authorization scheme as an authorization parameter. Will default authorization scheme to ServicePrincipal.");
            authType = "ServicePrincipal";
        }
    }

    let telemetry = {
        command: command,
        jobId: tl.getVariable('SYSTEM_JOBID'),
        scheme: authType
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
});
