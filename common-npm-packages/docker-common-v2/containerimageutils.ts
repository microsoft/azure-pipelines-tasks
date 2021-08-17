"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from 'fs';
import ContainerConnection from "./containerconnection";

export function hasRegistryComponent(imageName: string): boolean {
    var periodIndex = imageName.indexOf("."),
        colonIndex = imageName.indexOf(":"),
        slashIndex = imageName.indexOf("/");
    return ((periodIndex > 0 && periodIndex < slashIndex) ||
        (colonIndex > 0 && colonIndex < slashIndex));
}

export function imageNameWithoutTag(imageName: string): string {
    var endIndex = 0;
    if (hasRegistryComponent(imageName)) {
        // Contains a registry component that may include ":", so omit
        // this part of the name from the main delimiter determination
        endIndex = imageName.indexOf("/");
    }
    endIndex = imageName.indexOf(":", endIndex);
    return generateValidImageName(endIndex < 0 ? imageName : imageName.substr(0, endIndex));
}

export function generateValidImageName(imageName: string): string {
    imageName = imageName.toLowerCase();
    imageName = imageName.replace(/ /g, "");
    return imageName;
}

export function getBaseImageNameFromDockerFile(dockerFilePath: string): string {
    const dockerFileContent = fs.readFileSync(dockerFilePath, 'utf-8').toString();
    const baseImageName = getBaseImageName(dockerFileContent);

    if (!baseImageName) {
        tl.debug(`Failed to get the base image name of Dockerfile : ${dockerFilePath}`);
    }

    return baseImageName
}

export function getBaseImageName(dockerFileContent: string): string {
    // This method takes into consideration multi-stage dockerfiles, it tries to find the final
    // base image for the container.
    // ex:
    // FROM ubuntu:16.04 as builder
    //
    // FROM builder as base
    // RUN echo 'test'
    //
    // FROM base
    // RUN echo 'test2'
    // 
    // This code is going to return ubuntu:16.04

    try {
        if (!dockerFileContent || dockerFileContent == "") {
            return null;
        }

        var lines = dockerFileContent.split(/[\r?\n]/);
        var aliasToImageNameMapping: Map<string, string> = new Map<string, string>();
        var baseImage = "";

        for (var i = 0; i < lines.length; i++) {
            const currentLine = lines[i].trim();
            if (!currentLine.toUpperCase().startsWith("FROM")) {
                continue;
            }
            var nameComponents = currentLine.substring(4).toLowerCase().split(" as ");
            var prospectImageName = nameComponents[0].trim();

            if (nameComponents.length > 1) {
                var alias = nameComponents[1].trim();

                if (aliasToImageNameMapping.has(prospectImageName)) {
                    aliasToImageNameMapping.set(alias, aliasToImageNameMapping.get(prospectImageName));
                } else {
                    aliasToImageNameMapping.set(alias, prospectImageName);
                }

                baseImage = aliasToImageNameMapping.get(alias);
            } else {
                baseImage = aliasToImageNameMapping.has(prospectImageName)
                    ? aliasToImageNameMapping.get(prospectImageName)
                    : prospectImageName;
            }
        }

        return baseImage.includes("$") // In this case the base image has an argument and we don't know what its real value is
            ? null
            : sanityzeBaseImage(baseImage);
    } catch (error) {
        tl.debug(`An error ocurred getting the base image name. ${error.message}`);
        return null;
    }
}

function sanityzeBaseImage(baseImage: string): string {
    if (!baseImage){
        return null;
    }

    // If the baseimage name contains the digest we should remove the digest from its name
    // ubuntu:16.04@sha256:123412343 should be just ubuntu:16.04
    let baseImageComponents: string[] = baseImage.split("@");

    return baseImageComponents[0];
}

export function getResourceName(image: string, digest: string) {
    var match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/);
    if (!match) {
        return null;
    }

    var registry = match[1];
    var namespace = match[2];
    var repository = match[3];
    var tag = match[4];

    if (!namespace && registry && !/[:.]/.test(registry)) {
        namespace = registry
        registry = 'docker.io'
    }

    if (!namespace && !registry) {
        registry = 'docker.io'
        namespace = 'library'
    }

    registry = registry ? registry + '/' : '';
    namespace = namespace ? namespace + '/' : '';

    return "https://" + registry + namespace + repository + "@sha256:" + digest;
}

export function getImageDigest(connection: ContainerConnection, imageName: string,): string {
    try {
        pullImage(connection, imageName);
        let inspectObj = inspectImage(connection, imageName);

        if (!inspectObj) {
            return null;
        }

        let repoDigests: string[] = inspectObj.RepoDigests;

        if (repoDigests.length == 0) {
            tl.debug(`No digests were found for image: ${imageName}`);
            return null;
        }

        if (repoDigests.length > 1) {
            tl.debug(`Multiple digests were found for image: ${imageName}`);
            return "";
        }

        return repoDigests[0].split("@")[1];
    } catch (error) {
        tl.debug(`An exception was thrown getting the image digest for ${imageName}, the error was ${error.message}`)
        return null;
    }
}

function pullImage(connection: ContainerConnection, imageName: string) {
    let pullCommand = connection.createCommand();
    pullCommand.arg("pull");
    pullCommand.arg(imageName);
    let pullResult = pullCommand.execSync();

    if (pullResult.stderr && pullResult.stderr != "") {
        tl.debug(`An error was found pulling the image ${imageName}, the command output was ${pullResult.stderr}`);
    }
}

function inspectImage(connection: ContainerConnection, imageName): any {
    try {
        let inspectCommand = connection.createCommand();
        inspectCommand.arg("inspect");
        inspectCommand.arg(imageName);
        let inspectResult = inspectCommand.execSync();

        if (inspectResult.stderr && inspectResult.stderr != "") {
            tl.debug(`An error was found inspecting the image ${imageName}, the command output was ${inspectResult.stderr}`);
            return null;
        }

        let inspectObj = JSON.parse(inspectResult.stdout);

        if (!inspectObj || inspectObj.length == 0) {
            tl.debug(`Inspecting the image ${imageName} produced no results.`);
            return null;
        }

        return inspectObj[0];
    } catch (error) {
        tl.debug(`An error ocurred running the inspect command: ${error.message}`);
        return null;
    }
}

export function shareBuiltImageId(builtImageId: string) {
    const IMAGE_SEPARATOR_CHAR: string = ";";
    const ENV_VARIABLE_MAX_SIZE = 32766;
    let builtImages: string = tl.getVariable("DOCKER_TASK_BUILT_IMAGES");

    if (builtImages && builtImages != "") {
        const newImageId = `${IMAGE_SEPARATOR_CHAR}${builtImages}`;

        if (newImageId.length + builtImages.length > ENV_VARIABLE_MAX_SIZE) {
            tl.debug("Images id truncated maximum environment variable size reached.");
            return;
        }

        builtImages += newImageId;
    }
    else {
        builtImages = builtImageId;
    }

    tl.setVariable("DOCKER_TASK_BUILT_IMAGES", builtImages);
}

export function getImageIdFromBuildOutput(output: string): string {
    const standardParser = (text: string): string => {
        let parsedOutput: string[] = text.match(new RegExp("Successfully built ([0-9a-f]{12})", 'g'));

        return !parsedOutput || parsedOutput.length == 0
            ? ""
            : parsedOutput[parsedOutput.length - 1].substring(19); // This remove the Succesfully built section
    };

    const buildKitParser = (text: string): string => {
        let parsedOutput: string[] = text.match(new RegExp("writing image sha256:([0-9a-f]{64})", 'gi'));

        return !parsedOutput || parsedOutput.length == 0
            ? ""
            : parsedOutput[parsedOutput.length - 1].substring(21, 33); // This remove the section Writing Image Sha256 and takes 12 characters from the Id.
    }

    try {
        let buildOutputParserFuncs = [standardParser, buildKitParser];
        for (let parserFunc of buildOutputParserFuncs) {
            const builtImageId = parserFunc(output);
            if (builtImageId) {
                return builtImageId;
            }
        }
    } catch (error) {
        tl.debug(`An error occurred getting the image id from the docker ouput: ${error.message}`)
    }

    return "";
}
