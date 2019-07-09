"use strict";

import * as fs from "fs";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as sourceUtils from "docker-common/sourceutils";
import * as imageUtils from "docker-common/containerimageutils";
import * as utils from "./utils";
import * as Q from 'q';

function dockerTag(connection: ContainerConnection, sourceImage: string, targetImage: string, qualifyImageName: boolean): Q.Promise<void> {
    let command = connection.createCommand();
    command.arg("tag");
    if (qualifyImageName) {
        sourceImage = connection.getQualifiedImageNameIfRequired(sourceImage);
        targetImage = connection.getQualifiedImageNameIfRequired(targetImage);
    }
    command.arg(sourceImage);
    command.arg(targetImage);

    tl.debug(`Tagging image ${sourceImage} with ${targetImage}.`);
    return connection.execCommand(command);
}

export function run(connection: ContainerConnection): Q.Promise<void> {
    let imageNames;
    let useMultiImageMode = tl.getBoolInput("tagMultipleImages");
    if (useMultiImageMode) {
        imageNames = utils.getImageNames();
    } else {
        imageNames = [utils.getImageName()];
    }
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    let additionalImageTags = tl.getDelimitedInput("arguments", "\n");
    let imageMappings = utils.getImageMappings(connection, imageNames, additionalImageTags);

    let firstMapping = imageMappings.shift();
    let promise = dockerTag(connection, firstMapping.sourceImageName, firstMapping.targetImageName, qualifyImageName);
    imageMappings.forEach(mapping => {
        promise = promise.then(() => dockerTag(connection, mapping.sourceImageName, mapping.targetImageName, qualifyImageName));
    });

    return promise;
}