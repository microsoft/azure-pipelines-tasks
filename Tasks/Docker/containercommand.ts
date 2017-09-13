"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.line(tl.getInput("customCommand", true));
    return connection.execCommand(command);
}
