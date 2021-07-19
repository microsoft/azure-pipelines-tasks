"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as utils from "./utils";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    var command = connection.createComposeCommand();
    command.line(tl.getInput("dockerComposeCommand", true));

    var args = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(args || "");
    command.line(commandArgs || "");

    return connection.execCommandWithLogging(command)
    .then((output) => outputUpdate(utils.writeTaskOutput("command", output)));
}
