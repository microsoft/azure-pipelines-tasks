"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import DockerConnection from "./dockerConnection";

export function run(connection: DockerConnection): any {
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

    var imageName = tl.getInput("imageName", true);
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.qualifyImageName(imageName);
    }
    command.arg(imageName);

    var containerCommand = tl.getInput("containerCommand");
    if (containerCommand) {
        command.line(containerCommand);
    }

    return connection.execCommand(command);
}
