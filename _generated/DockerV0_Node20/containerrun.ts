"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as utils from "./utils";

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.arg("run");

    var detached = tl.getBoolInput("detached");
    if (detached) {
        command.arg("-d");
    }

    var entrypoint = tl.getInput("entrypoint");
    if (entrypoint) {
        command.arg(["--entrypoint", entrypoint]);
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

    if (!detached) {
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
                var restartMaxRetries = tl.getInput("restartMaxRetries");
                if (restartMaxRetries) {
                    var restartMaxRetriesNum = parseInt(restartMaxRetries, 10);
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

    var workDir = tl.getInput("workDir");
    if (workDir) {
        command.arg(["-w", workDir]);
    }

    var memory = tl.getInput("memory");
    if (memory) {
        command.arg(["-m", memory]);
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
