"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";

export function run(connection: ContainerConnection,  outputUpdate: (data: string) => any): any {
    var command = connection.createCommand();
    command.on("stdout", output => {
        outputUpdate(output);
    });

    var dockerCommand = tl.getInput("command", true);
    command.arg(dockerCommand);
    
    var commandArguments = dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    command.line(commandArguments);
    return connection.execCommand(command);
}
