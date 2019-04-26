"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as dockerCommandUtils from "docker-common/dockercommandutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let output = "";
    var dockerCommand = tl.getInput("command", true);    
    var commandArguments = tl.getInput("arguments", false);

    return dockerCommandUtils.command(connection, dockerCommand, commandArguments, (data) => output += data).then(() => {
        let taskOutputPath = utils.writeTaskOutput(dockerCommand, output);
        outputUpdate(taskOutputPath);
    });
}
