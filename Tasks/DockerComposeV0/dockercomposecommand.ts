"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";

export function run(connection: DockerComposeConnection): any {
    var command = connection.createComposeCommand();
    command.line(tl.getInput("dockerComposeCommand", true));
    return connection.execCommand(command);
}
