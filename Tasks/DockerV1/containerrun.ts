"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.arg("run");

    var runInBackground = tl.getBoolInput("runInBackground");
    if (runInBackground) {
        command.arg("-d");
    }
    
    var commandArguments = dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    command.line(commandArguments);

    var entrypointOverride = tl.getInput("entrypointOverride");
    if (entrypointOverride) {
        command.arg(["--entrypoint", entrypointOverride]);
    }

    tl.getDelimitedInput("envVars", "\n").forEach(envVar => {
        command.arg(["-e", envVar]);
    });

    var containerName = tl.getInput("containerName");
    if (containerName) {
        command.arg(["--name", containerName]);
    }

    tl.getDelimitedInput("ports", "\n").forEach(port => {
        command.arg(["-p", port]);
    });

    if (!runInBackground) {
        command.arg("--rm");
    } else {
        var restartPolicy = {
            no: "no",
            onFailure: "on-failure",
            always: "always",
            unlessStopped: "unless-stopped"
        }[tl.getInput("restartPolicy")];
        if (restartPolicy) {
            if (restartPolicy === "on-failure") {
                var maxRestartRetries = tl.getInput("maxRestartRetries");
                if (maxRestartRetries) {
                    var restartMaxRetriesNum = parseInt(maxRestartRetries, 10);
                    if (isNaN(restartMaxRetriesNum)) {
                        throw new Error("Maximum Restart Retries is not a number.");
                    }
                    restartPolicy += ":" + restartMaxRetriesNum;
                }
            }
            command.arg(["--restart", restartPolicy]);
        }
    }

    tl.getDelimitedInput("volumes", "\n").forEach(volume => {
        command.arg(["-v", volume]);
    });

    var workingDirectory = tl.getInput("workingDirectory");
    if (workingDirectory) {
        command.arg(["-w", workingDirectory]);
    }

    var memoryLimit = tl.getInput("memoryLimit");
    if (memoryLimit) {
        command.arg(["-m", memoryLimit]);
    }

    var imageName = utils.getImageName();
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.getQualifiedImageNameIfRequired(imageName);
    }
    command.arg(imageName);

    var containerCommand = tl.getInput("containerCommand");
    if (containerCommand) {
        command.line(containerCommand);
    }

    return connection.execCommand(command);
}
