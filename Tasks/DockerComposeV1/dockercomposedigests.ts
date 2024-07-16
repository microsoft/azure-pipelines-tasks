"use strict";

import * as fs from "fs";
import * as tl from "azure-pipelines-task-lib/task";
import * as yaml from "js-yaml";
import DockerComposeConnection from "./dockercomposeconnection";
import * as imageUtils from "azure-pipelines-tasks-docker-common/containerimageutils";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as utils from "./utils";

async function dockerPull(connection: DockerComposeConnection, imageName: string, imageDigests: any, serviceName: string) : Promise<string> {
    var command = connection.createCommand();
    command.arg("pull");
    var arg = tl.getInput("arguments", false);
    var commandArgs = dockerCommandUtils.getCommandArguments(arg || "");
    command.line(commandArgs || "");
    command.arg(imageName);

    const output = await connection.execCommandWithLogging(command);

    // Parse the output to find the repository digest
    var imageDigest = output.match(/^Digest: (.*)$/m)[1];
    if (imageDigest) {
        var baseImageName = imageUtils.imageNameWithoutTag(imageName);
        imageDigests[serviceName] = baseImageName + "@" + imageDigest;
    }
    
    return output;
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
                if (!promise) {
                    promise = dockerPull(connection, imageName, imageDigests, serviceName);
                } else {
                    promise = promise.then(() => dockerPull(connection, imageName, imageDigests, serviceName));                    
                }
                promise = promise.then((output) => outputUpdate(utils.writeTaskOutput(`pull_${imageName}`, output)));
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
