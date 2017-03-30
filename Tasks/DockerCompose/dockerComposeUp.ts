"use strict";

import * as tl from "vsts-task-lib/task";
import DockerComposeConnection from "./dockerComposeConnection";

export function run(connection: DockerComposeConnection): any {
    var command = connection.createComposeCommand();
    command.arg("up");

    var detached = tl.getBoolInput("detached");
    if (detached) {
        command.arg("-d");
    }

    var buildImages = tl.getBoolInput("buildImages");
    if (buildImages) {
        command.arg("--build");
    }

    var abortOnContainerExit = tl.getBoolInput("abortOnContainerExit");
    if (!detached && abortOnContainerExit) {
        command.arg("--abort-on-container-exit");
    }

    return connection.execCommand(command);
}
