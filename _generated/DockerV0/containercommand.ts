"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    var command = connection.createCommand();
    command.on("stdout", output => {
        outputUpdate(output);
    });
    command.line(tl.getInput("customCommand", true));
    return connection.execCommand(command);
}
