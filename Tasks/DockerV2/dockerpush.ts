"use strict";

import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as dockerCommandUtils from "docker-common/dockercommandutils";
import * as utils from "./utils";
import Q = require('q');

function pushMultipleImages(connection: ContainerConnection, imageNames: string[], tags: string[], commandArguments: string, onCommandOut: (output) => any): any {
    let promise: Q.Promise<void>;
    // create chained promise of push commands
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    let imageNameWithTag = imageName + ":" + tag;
                    if (promise) {
                        promise = promise.then(() => dockerCommandUtils.push(connection, imageNameWithTag, commandArguments, onCommandOut));
                    }
                    else {
                        promise = dockerCommandUtils.push(connection, imageNameWithTag, commandArguments, onCommandOut);
                    }
                });
            }
            else {
                if (promise) {
                    promise = promise.then(() => dockerCommandUtils.push(connection, imageName, commandArguments, onCommandOut));
                }
                else {
                    promise = dockerCommandUtils.push(connection, imageName, commandArguments, onCommandOut);
                }
            }
        });
    }

    // will return undefined promise in case imageNames is null or empty list
    return promise;
}

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
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

    // push all tags
    let output = "";
    let promise = this.pushMultipleImages(connection, imageNames, tags, commandArguments, (commandOut) => output += commandOut);
    
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
