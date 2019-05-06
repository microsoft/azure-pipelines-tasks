"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection,  outputUpdate: (data: string) => any): any {
    var command = connection.createCommand();
    command.on("stdout", output => {
        outputUpdate(output);
    });

    var dockerCommand = tl.getInput("command", true);
    command.arg(dockerCommand);
    
    var commandArguments = tl.getInput("arguments", false);
    if (commandArguments) {
        commandArguments = commandArguments.replace(/\n/g, " ");
    }

    command.line(commandArguments);
    return connection.execCommand(command);
}
