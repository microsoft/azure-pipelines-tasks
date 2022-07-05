"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import * as utils from "./utils";

export async function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): Promise<any> {
    var command = connection.createComposeCommand();
    command.arg("run");

    var detached = tl.getBoolInput("detached");
    if (detached) {
        command.arg("-d");
    }

    var entrypoint = tl.getInput("entrypoint");
    if (entrypoint) {
        command.arg(["--entrypoint", entrypoint]);
    }

    var containerName = tl.getInput("containerName");
    if (containerName) {
        command.arg(["--name", containerName]);
    }

    tl.getDelimitedInput("ports", "\n").forEach(port => {
        command.arg(["-p", port]);
    });

    if (!detached) {
        command.arg("--rm");
    }

    command.arg("-T");

    var workDir = tl.getInput("workDir");
    if (workDir) {
        command.arg(["-w", workDir]);
    }

    var serviceName = tl.getInput("serviceName", true);
    command.arg(serviceName);

    var arg = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(arg || "");
    command.line(commandArgs || "");

    var containerCommand = tl.getInput("containerCommand");
    if (containerCommand) {
        command.line(containerCommand);
    }

    try {
        await connection.execCommandWithLogging(command)
        .then((output) => outputUpdate(utils.writeTaskOutput("run", output)));
    } finally {
        if (!detached) {
            
            var downCommand = connection.createComposeCommand();
            downCommand.arg("down");

            await connection.execCommandWithLogging(downCommand)
            .then((output) => outputUpdate(utils.writeTaskOutput("down", output)));            
        }
    }
}
