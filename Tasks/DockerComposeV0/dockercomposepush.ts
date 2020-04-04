"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as sourceUtils from "docker-common-v2/sourceutils";
import * as imageUtils from "docker-common-v2/containerimageutils";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import * as utils from "./utils";

function dockerPush(connection: DockerComposeConnection, imageName: string, onCommandOut: (output: any) => any) {
    var command = connection.createCommand();
    command.arg("push");
    var arg = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(arg || "");
    command.line(commandArgs || "");
    command.arg(imageName);

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command)
    .then(() => onCommandOut(output + "\n"));
}

function pushTag(promise: any, connection: DockerComposeConnection, imageName: string, onCommandOut: (output: any) => any) {
    if (!promise) {
        return dockerPush(connection, imageName, onCommandOut);
    } else {
        return promise.then(() => dockerPush(connection, imageName, onCommandOut));
    }
}

function pushTags(connection: DockerComposeConnection, imageName: string, onCommandOut: (output: any) => any): any {
    var baseImageName = imageUtils.imageNameWithoutTag(imageName);
    if (baseImageName == imageName)
    {
        tl.debug(tl.loc('ImageNameWithoutTag'));
    }

    return dockerPush(connection, imageName, onCommandOut)
    .then(function pushAdditionalTags() {
        var promise: any;
        tl.getDelimitedInput("additionalImageTags", "\n").forEach(tag => {
            promise = pushTag(promise, connection, baseImageName + ":" + tag, onCommandOut);
        });
        return promise;
    })
    .then(function pushSourceTags() {
        var promise: any;
        var includeSourceTags = tl.getBoolInput("includeSourceTags");
        if (includeSourceTags) {
            sourceUtils.getSourceTags().forEach(tag => {
                promise = pushTag(promise, connection, baseImageName + ":" + tag, onCommandOut);
            });
        }
        return promise;
    })
    .then(function pushLatestTag() {
        var includeLatestTag = tl.getBoolInput("includeLatestTag");
        if (baseImageName !== imageName && includeLatestTag) {
            return dockerPush(connection, baseImageName + ":latest", onCommandOut);
        }
    });
}

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    return connection.getImages(true)
    .then(images => {
        var promise: any;
        Object.keys(images).forEach(serviceName => {
            (imageName => {
                let output = "";
                if (!promise) {
                    promise = pushTags(connection, imageName, (data) => output += data)
                    .then(() => outputUpdate(utils.writeTaskOutput(`push_${imageName}`, output)));
                } else {
                    promise = promise.then(() => pushTags(connection, imageName, (data) => output += data))
                    .then(() => outputUpdate(utils.writeTaskOutput(`push_${imageName}`, output)));
                }
            })(images[serviceName]);
        });
        return promise;
    });
}
