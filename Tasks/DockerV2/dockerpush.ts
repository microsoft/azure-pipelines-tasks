"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as utils from "./utils";
import * as Q from "Q";

function dockerPush(connection: ContainerConnection, image: string, commandArguments: string, onCommandOut: (output) => any): any {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(image);
    command.line(commandArguments);

    var output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Return the std output of the command by calling the deligate
        onCommandOut(output + "\r\n");
    });
}

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let command = tl.getInput("command", true);
    var commandArguments = tl.getInput("arguments", false); 

    // get tags input
    let tags = tl.getDelimitedInput("tags", "\n");

    // get qualified image name from the containerRegistry input
    let repositoryName = tl.getInput("repository");
    let imageNames: string[] = [];

    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName);
    }

    let promise: Q.Promise<void>;
    // push all tags
    let output = "";
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    let imageNameWithTag = imageName + ":" + tag;
                    if (promise) {
                        promise = promise.then(() => dockerPush(connection, imageNameWithTag, commandArguments, (commandOut) => output += commandOut));
                    }
                    else {
                        promise = dockerPush(connection, imageNameWithTag, commandArguments, (commandOut) => output += commandOut);
                    }
                });
            }
            else {
                if (promise) {
                    promise = promise.then(() => dockerPush(connection, imageName, commandArguments, (commandOut) => output += commandOut));
                }
                else {
                    promise = dockerPush(connection, imageName, commandArguments, (commandOut) => output += commandOut);
                }
            }
        });
    }
    
    if (promise) {
        promise = promise.then(() => {
            let taskOutputPath = utils.writeTaskOutput("push", output);
            outputUpdate(taskOutputPath);
        });
    }
    else {
        promise = Q.resolve(null);
    }

    return promise;
}
