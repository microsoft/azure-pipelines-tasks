"use strict";

import * as tl from "vsts-task-lib/task";
import DockerConnection from "./dockerConnection";

// Change to any specified working directory
tl.cd(tl.getInput("cwd"));

// Connect to any specified Docker host and/or registry 
var connection = new DockerConnection();
connection.open(tl.getInput("dockerHostEndpoint"), tl.getInput("dockerRegistryEndpoint"));

// Run the specified action
var action = tl.getInput("action", true);
/* tslint:disable:no-var-requires */
require({
    "Build an image": "./dockerBuild",
    "Push an image": "./dockerPush",
    "Run an image": "./dockerRun",
    "Run a Docker command": "./dockerCommand"
}[action]).run(connection)
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
