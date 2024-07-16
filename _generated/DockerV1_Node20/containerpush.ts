"use strict";

import * as fs from "fs";
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as imageUtils from "azure-pipelines-tasks-docker-common/containerimageutils";
import * as utils from "./utils";

function dockerPush(connection: ContainerConnection, image: string, imageDigestFile?: string, useMultiImageMode?: boolean, commandArguments?: string): any {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(image);
    command.line(commandArguments);

    if (!imageDigestFile) {
        return connection.execCommand(command);
    }

    var output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Parse the output to find the repository digest
        var imageDigest = output.match(/^[^:]*: digest: ([^ ]*) size: \d*$/m)[1];
        if (imageDigest) {
            let baseImageName = imageUtils.imageNameWithoutTag(image);
            let formattedDigestValue = baseImageName + "@" + imageDigest;
            if (useMultiImageMode) {
                // If we're pushing multiple images, we need to append all the digest values. Each one is contained on its own line.
                fs.appendFileSync(imageDigestFile, formattedDigestValue + "\r\n");
            } else {
                fs.writeFileSync(imageDigestFile, formattedDigestValue);
            }
        }
    });
}

export function run(connection: ContainerConnection): any {
    try {
        var imageLsCommand = connection.createCommand();
        imageLsCommand.arg("images");
        connection.execCommand(imageLsCommand);
    } catch (ex) {
        
    }

    let command = tl.getInput("command", true);    
    var commandArguments = dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    let imageNames;
    let useMultiImageMode = tl.getBoolInput("pushMultipleImages");
    if (useMultiImageMode) {
        imageNames = utils.getImageNames();
    } else {
        imageNames = [utils.getImageName()];
    }
    
    let imageMappings = utils.getImageMappings(connection, imageNames, []);

    let imageDigestFile: string = null;
    if (tl.filePathSupplied("imageDigestFile")) {
        imageDigestFile = tl.getPathInput("imageDigestFile");
    }

    let firstImageMapping = imageMappings.shift();
    let pushedSourceImages = [firstImageMapping.sourceImageName];
    let promise = dockerPush(connection, firstImageMapping.targetImageName, imageDigestFile, useMultiImageMode, commandArguments);
    imageMappings.forEach(imageMapping => {
        // If we've already pushed a tagged version of this source image, then we don't want to write the digest info to the file since it will be duplicate.
        if (pushedSourceImages.indexOf(imageMapping.sourceImageName) >= 0) {
            promise = promise.then(() => dockerPush(connection, imageMapping.targetImageName, commandArguments = commandArguments));
        } else {
            pushedSourceImages.push(imageMapping.sourceImageName);
            promise = promise.then(() => dockerPush(connection, imageMapping.targetImageName, imageDigestFile, useMultiImageMode, commandArguments));
        }
    });

    return promise;
}
