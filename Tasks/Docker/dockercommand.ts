"use strict";

import * as tl from "vsts-task-lib/task";
import DockerConnection from "./dockerconnection";

export function run(connection: DockerConnection): any {
    var command = connection.createCommand();
    command.line(tl.getInput("customCommand", true));
    return connection.execCommand(command);
}
