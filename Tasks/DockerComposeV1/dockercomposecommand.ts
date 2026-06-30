"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as utils from "./utils";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as DockerComposeUtils from "./dockercomposeutils";

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    var args = tl.getInput("arguments", false);
    var parsedArgs = DockerComposeUtils.parseComposeArguments(args || "");
    
    var command = connection.createComposeCommand(parsedArgs.globalArgs);
    command.line(tl.getInput("dockerComposeCommand", true));

    // Add command-specific arguments
    if (parsedArgs.commandArgs.length > 0) {
        parsedArgs.commandArgs.forEach(cmdArg => {
            command.arg(cmdArg);
        });
    }

    return connection.execCommandWithLogging(command)
    .then((output) => outputUpdate(utils.writeTaskOutput("command", output)));
}
