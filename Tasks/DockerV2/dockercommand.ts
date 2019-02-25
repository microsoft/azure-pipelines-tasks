"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as utils from "./utils";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    var command = connection.createCommand();
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    var dockerCommand = tl.getInput("command", true);
    command.arg(dockerCommand);
    
    var commandArguments = tl.getInput("arguments", false); 
    command.line(commandArguments);
    return connection.execCommand(command).then(() => {
        let taskOutputPath = utils.writeTaskOutput(dockerCommand, output);
        outputUpdate(taskOutputPath);
    });
}
