"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as utils from "./utils";
import * as Q from 'q';

function dockerTag(connection: ContainerConnection, sourceImage: string, targetImage: string): Q.Promise<void> {
    let command = connection.createCommand();
    command.arg("tag");
    command.arg(sourceImage);
    command.arg(targetImage);

    tl.debug(`Tagging image ${sourceImage} with ${targetImage}.`);
    return connection.execCommand(command);
}

export function run(connection: ContainerConnection): Q.Promise<void> {
    let imageNames = utils.getImageNames();
    let imageMappings = utils.getImageMappings(connection, imageNames);

    let firstMapping = imageMappings.shift();
    let promise = dockerTag(connection, firstMapping.sourceImageName, firstMapping.targetImageName);
    imageMappings.forEach(mapping => {
        promise = promise.then(() => dockerTag(connection, mapping.sourceImageName, mapping.targetImageName));
    });

    return promise;
}