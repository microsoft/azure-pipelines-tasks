"use strict";

import * as fs from "fs";
import * as tl from "vsts-task-lib/task";
import DockerConnection from "./dockerConnection";
import * as sourceUtils from "./sourceUtils";
import * as imageUtils from "./dockerImageUtils";

function dockerPush(connection: DockerConnection, imageName: string, imageDigestFile?: string): any {
    var command = connection.createCommand();
    command.arg("push");
    command.arg(imageName);

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
            var baseImageName = imageUtils.imageNameWithoutTag(imageName);
            fs.writeFileSync(imageDigestFile, baseImageName + "@" + imageDigest);
        }
    });
}

export function run(connection: DockerConnection): any {
    var images = [];
    var imageName = tl.getInput("imageName", true);
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.qualifyImageName(imageName);
    }
    var baseImageName = imageUtils.imageNameWithoutTag(imageName);

    if (baseImageName === imageName) {
        images.push(imageName + ":latest");
    } else {
        images.push(imageName);
    }

    tl.getDelimitedInput("additionalImageTags", "\n").forEach(tag => {
        images.push(baseImageName + ":" + tag);
    });

    var includeSourceTags = tl.getBoolInput("includeSourceTags");
    if (includeSourceTags) {
        sourceUtils.getSourceTags().forEach(tag => {
            images.push(baseImageName + ":" + tag);
        });
    }

    var includeLatestTag = tl.getBoolInput("includeLatestTag");
    if (baseImageName !== imageName && includeLatestTag) {
        images.push(baseImageName + ":latest");
    }

    var imageDigestFile: string;
    if (tl.filePathSupplied("imageDigestFile")) {
        imageDigestFile = tl.getPathInput("imageDigestFile");
    }

    var promise = dockerPush(connection, images.shift(), imageDigestFile);
    images.forEach(imageName => {
        promise = promise.then(() => dockerPush(connection, imageName));
    });

    return promise;
}
