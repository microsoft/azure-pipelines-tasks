"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as utils from "./utils";
import * as Q from 'q';

function dockerTag(connection: ContainerConnection, sourceImage: string, targetImage: string, qualifyImageName: boolean, qualifySourceImageName: boolean): Q.Promise<void> {
    let command = connection.createCommand();
    command.arg("tag");
    if (qualifyImageName) {
        targetImage = connection.getQualifiedImageNameIfRequired(targetImage);
    }
    if (qualifySourceImageName) {
        sourceImage = connection.getQualifiedImageNameIfRequired(sourceImage);
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
    const qualifySourceImageName = tl.getBoolInput("qualifySourceImageName");
    let additionalImageTags = tl.getDelimitedInput("arguments", "\n");
    let imageMappings = utils.getImageMappings(connection, imageNames, additionalImageTags);

    let firstMapping = imageMappings.shift();
    let promise = dockerTag(connection, firstMapping.sourceImageName, firstMapping.targetImageName, qualifyImageName, qualifySourceImageName);
    imageMappings.forEach(mapping => {
        promise = promise.then(() => dockerTag(connection, mapping.sourceImageName, mapping.targetImageName, qualifyImageName, qualifySourceImageName));
    });

    return promise;
}