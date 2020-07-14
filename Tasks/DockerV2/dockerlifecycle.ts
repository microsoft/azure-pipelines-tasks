"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "docker-common-v2/containerconnection";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let output = "";
    let command = tl.getInput("command", true);
    let containerName = tl.getInput("container", true);
    let commandArguments = dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    let containerMap = tl.getVariable("agent.containermapping");
    if (!containerMap) {
        throw new Error(tl.loc('ContainerNotFound', containerName));
    }

    let map = JSON.parse(containerMap);
    let containerId = map[containerName].id;
    if (!containerId || containerId == "") {
        throw new Error(tl.loc('ContainerNotFound', containerName));
    }

    if (command == "start")  {
        return dockerCommandUtils.start(connection, containerId, commandArguments, (data) => output += data).then(() => {
            let taskOutputPath = utils.writeTaskOutput("start", output);
            outputUpdate(taskOutputPath);
        });
    } else if (command == "stop") {
        return dockerCommandUtils.stop(connection, containerId, commandArguments, (data) => output += data).then(() => {
            let taskOutputPath = utils.writeTaskOutput("stop", output);
            outputUpdate(taskOutputPath);
        });
    } else {
        throw new Error(tl.loc('CommandNotRecognized', command));
    }
}
