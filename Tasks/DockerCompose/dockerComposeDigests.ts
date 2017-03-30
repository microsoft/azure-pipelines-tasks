"use strict";

import * as fs from "fs";
import * as tl from "vsts-task-lib/task";
import * as yaml from "js-yaml";
import DockerComposeConnection from "./dockerComposeConnection";
import * as imageUtils from "./dockerImageUtils";

function dockerPull(connection: DockerComposeConnection, imageName: string, imageDigests: any, serviceName: string) {
    var command = connection.createCommand();
    command.arg("pull");
    command.arg(imageName);

    var output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        // Parse the output to find the repository digest
        var imageDigest = output.match(/^Digest: (.*)$/m)[1];
        if (imageDigest) {
            var baseImageName = imageUtils.imageNameWithoutTag(imageName);
            imageDigests[serviceName] = baseImageName + "@" + imageDigest;
        }
    });
}

function writeImageDigestComposeFile(version: string, imageDigests: any, imageDigestComposeFile: string): void {
    var services = {};
    Object.keys(imageDigests).forEach(serviceName => {
        services[serviceName] = {
            image: imageDigests[serviceName]
        };
    });
    fs.writeFileSync(imageDigestComposeFile, yaml.safeDump({
        version: version,
        services: services
    }, { lineWidth: -1 } as any));
}

export function createImageDigestComposeFile(connection: DockerComposeConnection, imageDigestComposeFile: string) {
    return connection.getImages().then(images => {
        var promise: any;
        var version = connection.getVersion();
        var imageDigests = {};
        Object.keys(images).forEach(serviceName => {
            (imageName => {
                if (!promise) {
                    promise = dockerPull(connection, imageName, imageDigests, serviceName);
                } else {
                    promise = promise.then(() => dockerPull(connection, imageName, imageDigests, serviceName));
                }
            })(images[serviceName]);
        });
        if (!promise) {
            writeImageDigestComposeFile(version, imageDigests, imageDigestComposeFile);
        } else {
            return promise.then(() => writeImageDigestComposeFile(version, imageDigests, imageDigestComposeFile));
        }
    });
}

export function run(connection: DockerComposeConnection): any {
    var imageDigestComposeFile = tl.getPathInput("imageDigestComposeFile", true);
    return createImageDigestComposeFile(connection, imageDigestComposeFile);
}
