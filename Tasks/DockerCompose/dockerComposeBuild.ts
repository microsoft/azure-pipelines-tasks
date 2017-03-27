"use strict";

import * as tl from "vsts-task-lib/task";
import DockerComposeConnection from "./dockerComposeConnection";
import * as sourceUtils from "./sourceUtils";
import * as imageUtils from "./dockerImageUtils";

function dockerTag(connection: DockerComposeConnection, source: string, target: string) {
    var command = connection.createCommand();
    command.arg("tag");
    command.arg(source);
    command.arg(target);
    return connection.execCommand(command);
}

function addTag(promise: any, connection: DockerComposeConnection, source: string, target: string) {
    if (!promise) {
        return dockerTag(connection, source, target);
    } else {
        return promise.then(() => dockerTag(connection, source, target));
    }
}

function addOtherTags(connection: DockerComposeConnection, imageName: string): any {
    var baseImageName = imageUtils.imageNameWithoutTag(imageName);

    function addAdditionalTags() {
        var promise: any;
        tl.getDelimitedInput("additionalImageTags", "\n").forEach(tag => {
            promise = addTag(promise, connection, imageName, baseImageName + ":" + tag);
        });
        return promise;
    }

    function addSourceTags() {
        var promise: any;
        var includeSourceTags = tl.getBoolInput("includeSourceTags");
        if (includeSourceTags) {
            sourceUtils.getSourceTags().forEach(tag => {
                promise = addTag(promise, connection, imageName, baseImageName + ":" + tag);
            });
        }
        return promise;
    }

    function addLatestTag() {
        var includeLatestTag = tl.getBoolInput("includeLatestTag");
        if (baseImageName !== imageName && includeLatestTag) {
            return dockerTag(connection, imageName, baseImageName);
        }
    }

    var promise = addAdditionalTags();
    promise = !promise ? addSourceTags() : promise.then(addSourceTags);
    promise = !promise ? addLatestTag() : promise.then(addLatestTag);

    return promise;
}

export function run(connection: DockerComposeConnection): any {
    var command = connection.createComposeCommand();
    command.arg("build");
    return connection.execCommand(command)
    .then(() => connection.getImages(true))
    .then(images => {
        var promise: any;
        Object.keys(images).map(serviceName => images[serviceName]).forEach(imageName => {
            if (!promise) {
                promise = addOtherTags(connection, imageName);
            } else {
                promise = promise.then(() => addOtherTags(connection, imageName));
            }
        });
        return promise;
    });
}
