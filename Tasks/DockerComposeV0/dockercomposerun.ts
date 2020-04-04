"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import * as utils from "./utils";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
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

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    var promise = connection.execCommand(command)
    .then(() => outputUpdate(utils.writeTaskOutput("run", output)));

    if (!detached) {
        promise = promise.fin(() => {
            var downCommand = connection.createComposeCommand();
            downCommand.arg("down");

            let outputDown = "";
            downCommand.on("stdout", data => {
                outputDown += data;
            });

            return connection.execCommand(downCommand)
            .then(() => outputUpdate(utils.writeTaskOutput("down", outputDown)));
        });
    }

    return promise;
}
