"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as utils from "./utils";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
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

    var arg = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(arg || "");
    command.line(commandArgs || "");

    return connection.execCommandWithLogging(command)
    .then((output) => outputUpdate(utils.writeTaskOutput("up", output)))
}
