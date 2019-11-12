"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "docker-common-v2/containerconnection";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let output = "";
    let dockerCommand = tl.getInput("command", true);    
    let commandArguments = dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    return dockerCommandUtils.command(connection, dockerCommand, commandArguments, (data) => output += data).then(() => {
        let taskOutputPath = utils.writeTaskOutput(dockerCommand, output);
        outputUpdate(taskOutputPath);
    });
}
