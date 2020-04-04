"use strict";

import * as fs from "fs";
import * as tl from "azure-pipelines-task-lib/task";
import * as yaml from "js-yaml";
import DockerComposeConnection from "./dockercomposeconnection";
import * as imageUtils from "docker-common-v2/containerimageutils";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import * as utils from "./utils";

function dockerPull(connection: DockerComposeConnection, imageName: string, imageDigests: any, serviceName: string, onCommandOut: (output: any) => any) {
    var command = connection.createCommand();
    command.arg("pull");
    var arg = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(arg || "");
    command.line(commandArgs || "");
    command.arg(imageName);

    var output = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command)
    .then(() => onCommandOut(output + "\n"))
    .then(() => {
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

export function createImageDigestComposeFile(connection: DockerComposeConnection, imageDigestComposeFile: string, outputUpdate: (data: string) => any) {
    return connection.getImages().then(images => {
        var promise: any;
        var version = connection.getVersion();
        var imageDigests = {};
        Object.keys(images).forEach(serviceName => {
            (imageName => {
                let output = "";
                if (!promise) {
                    promise = dockerPull(connection, imageName, imageDigests, serviceName, (data) => output += data)
                    .then(() => outputUpdate(utils.writeTaskOutput(`pull_${imageName}`, output)));
                } else {
                    promise = promise.then(() => dockerPull(connection, imageName, imageDigests, serviceName, (data) => output += data))
                    .then(() => outputUpdate(utils.writeTaskOutput(`pull_${imageName}`, output)));
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

export function run(connection: DockerComposeConnection, outputUpdate: (data: string) => any): any {
    var imageDigestComposeFile = tl.getPathInput("imageDigestComposeFile", true);

    return createImageDigestComposeFile(connection, imageDigestComposeFile, outputUpdate);
}
