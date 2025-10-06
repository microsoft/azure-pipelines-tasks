"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as utils from "./utils";
import * as DockerComposeUtils from "./dockercomposeutils";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    var arg = tl.getInput("arguments", false);
    var parsedArgs = DockerComposeUtils.parseComposeArguments(arg || "");
    
    var command = connection.createComposeCommand(parsedArgs.globalArgs);
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

    // Add command-specific arguments
    if (parsedArgs.commandArgs.length > 0) {
        parsedArgs.commandArgs.forEach(cmdArg => {
            command.arg(cmdArg);
        });
    }

    return connection.execCommandWithLogging(command)
    .then((output) => outputUpdate(utils.writeTaskOutput("up", output)))
}
