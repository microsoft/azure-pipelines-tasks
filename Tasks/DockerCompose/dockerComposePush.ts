"use strict";

import * as tl from "vsts-task-lib/task";
import DockerComposeConnection from "./dockerComposeConnection";
import * as sourceUtils from "./sourceUtils";
import * as imageUtils from "./dockerImageUtils";

function dockerPush(connection: DockerComposeConnection, imageName: string) {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(imageName);
    return connection.execCommand(command);
}

function pushTag(promise: any, connection: DockerComposeConnection, imageName: string) {
    if (!promise) {
        return dockerPush(connection, imageName);
    } else {
        return promise.then(() => dockerPush(connection, imageName));
    }
}

function pushTags(connection: DockerComposeConnection, imageName: string): any {
    var baseImageName = imageUtils.imageNameWithoutTag(imageName);
    var builtImageName = imageName + (baseImageName === imageName ? ":latest" : "");
    return dockerPush(connection, builtImageName)
    .then(function pushAdditionalTags() {
        var promise: any;
        tl.getDelimitedInput("additionalImageTags", "\n").forEach(tag => {
            promise = pushTag(promise, connection, baseImageName + ":" + tag);
        });
        return promise;
    })
    .then(function pushSourceTags() {
        var promise: any;
        var includeSourceTags = tl.getBoolInput("includeSourceTags");
        if (includeSourceTags) {
            sourceUtils.getSourceTags().forEach(tag => {
                promise = pushTag(promise, connection, baseImageName + ":" + tag);
            });
        }
        return promise;
    })
    .then(function pushLatestTag() {
        var includeLatestTag = tl.getBoolInput("includeLatestTag");
        if (baseImageName !== imageName && includeLatestTag) {
            return dockerPush(connection, baseImageName + ":latest");
        }
    });
}

export function run(connection: DockerComposeConnection): any {
    return connection.getImages(true)
    .then(images => {
        var promise: any;
        Object.keys(images).forEach(serviceName => {
            (imageName => {
                if (!promise) {
                    promise = pushTags(connection, imageName);
                } else {
                    promise = promise.then(() => pushTags(connection, imageName));
                }
            })(images[serviceName]);
        });
        return promise;
    });
}
