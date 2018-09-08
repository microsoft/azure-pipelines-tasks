"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();

    var dockerCommand = tl.getInput("command", true);
    command.arg(dockerCommand);
    
    var commandArguments = tl.getInput("arguments", false); 
    command.line(commandArguments);
    return connection.execCommand(command);
}
