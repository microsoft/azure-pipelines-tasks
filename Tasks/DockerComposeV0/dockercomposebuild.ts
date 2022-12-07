"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import DockerComposeConnection from "./dockercomposeconnection";
import * as sourceUtils from "azure-pipelines-tasks-docker-common-v2/sourceutils";
import * as imageUtils from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import * as utils from "./utils";

function dockerTag(connection: DockerComposeConnection, source: string, target: string, outputUpdate: (output: any) => any) {
    var command = connection.createCommand();
    command.arg("tag");
    command.arg(source);
    command.arg(target);
    return connection.execCommandWithLogging(command)
    .then((output) => outputUpdate(utils.writeTaskOutput(`tag_${source}`, output)));
}

function addTag(promise: any, connection: DockerComposeConnection, source: string, target: string, onCommandOut: (data: string) => any) {
    if (!promise) {
        return dockerTag(connection, source, target, onCommandOut);
    } else {
        return promise.then(() => dockerTag(connection, source, target, onCommandOut));
    }
}

function addOtherTags(connection: DockerComposeConnection, imageName: string, outputUpdate: (data: string) => any): any {
    var baseImageName = imageUtils.imageNameWithoutTag(imageName);

    let output = "";

    function addAdditionalTags() {
        var promise: any;
        tl.getDelimitedInput("additionalImageTags", "\n").forEach(tag => {
            promise = addTag(promise, connection, imageName, baseImageName + ":" + tag, outputUpdate);
        });
        return promise;
    }

    function addSourceTags() {
        var promise: any;
        var includeSourceTags = tl.getBoolInput("includeSourceTags");
        if (includeSourceTags) {
            sourceUtils.getSourceTags().forEach(tag => {
                promise = addTag(promise, connection, imageName, baseImageName + ":" + tag, outputUpdate);
            });
        }
        return promise;
    }

    function addLatestTag() {
        var includeLatestTag = tl.getBoolInput("includeLatestTag");
        if (baseImageName !== imageName && includeLatestTag) {
            return dockerTag(connection, imageName, baseImageName, outputUpdate);
        }
    }

    var promise = addAdditionalTags();
    promise = !promise ? addSourceTags() : promise.then(addSourceTags);
    promise = !promise ? addLatestTag() : promise.then(addLatestTag);

    return promise;
}

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    var command = connection.createComposeCommand();
    command.arg("build");
    var arg = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(arg || "");
    command.line(commandArgs || "");

    return connection.execCommandWithLogging(command)
    .then((output) => outputUpdate(utils.writeTaskOutput("build", output)))
    .then(() => connection.getImages(true))
    .then(images => {
        var promise: any;
        Object.keys(images).map(serviceName => images[serviceName]).forEach(imageName => {
            if (!promise) {
                promise = addOtherTags(connection, imageName, outputUpdate);
            } else {
                promise = promise.then(() => addOtherTags(connection, imageName, outputUpdate));
            }
        });
        return promise;
    });
}
