"use strict";

import * as tl from "vsts-task-lib/task";
import DockerComposeConnection from "./dockerComposeConnection";

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

var dockerComposeFile = tl.getInput("dockerComposeFile", true);
var nopIfNoDockerComposeFile = tl.getBoolInput("nopIfNoDockerComposeFile");
if (nopIfNoDockerComposeFile && !tl.globFirst(dockerComposeFile)) {
    console.log("No Docker Compose file matching " + dockerComposeFile + " was found.");
    tl.setResult(tl.TaskResult.Succeeded, "");
} else {
    // Connect to any specified Docker host and/or registry 
    var connection = new DockerComposeConnection();
    connection.open(tl.getInput("dockerHostEndpoint"), tl.getInput("dockerRegistryEndpoint"))
    .then(function runAction() {
        // Run the specified action
        var action = tl.getInput("action", true);
        /* tslint:disable:no-var-requires */
        return require({
            "Build services": "./dockerComposeBuild",
            "Push services": "./dockerComposePush",
            "Run services": "./dockerComposeUp",
            "Run a specific service": "./dockerComposeRun",
            "Lock services": "./dockerComposeLock",
            "Write service image digests": "./dockerComposeDigests",
            "Combine configuration": "./dockerComposeConfig",
            "Run a Docker Compose command": "./dockerComposeCommand"
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
