"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import * as fileUtils from "azure-pipelines-tasks-docker-common-v2/fileutils";
import * as pipelineUtils from "azure-pipelines-tasks-docker-common-v2/pipelineutils";
import ContainerConnection from "azure-pipelines-tasks-docker-common-v2/containerconnection";
import * as sourceUtils from "azure-pipelines-tasks-docker-common-v2/sourceutils";
import * as imageUtils from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
import * as utils from "./utils";

interface ImageAnnotations {
    BaseImageName: string,
    BaseImageDigest: string
}

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.arg("build");

    var dockerfilepath = tl.getInput("dockerFile", true);
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);

    if (!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
    }

    let imageAnnotations: ImageAnnotations = null;
    if (isBaseImageLabelAnnotationEnabled()) {
        imageAnnotations = GetImageAnnotation(connection, dockerFile);
    }

    command.arg(["-f", dockerFile]);

    var addDefaultLabels = tl.getBoolInput("addDefaultLabels");
    if (addDefaultLabels) {
        pipelineUtils.addDefaultLabelArgs(command);
    }

    var commandArguments = dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    command.line(commandArguments);

    var imageName = utils.getImageName();
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.getQualifiedImageNameIfRequired(imageName);
    }
    command.arg(["-t", tl.getBoolInput("enforceDockerNamingConvention") ? imageUtils.generateValidImageName(imageName) : imageName]);

    var baseImageName = imageUtils.imageNameWithoutTag(imageName);

    var includeSourceTags = tl.getBoolInput("includeSourceTags");
    if (includeSourceTags) {
        sourceUtils.getSourceTags().forEach(tag => {
            command.arg(["-t", baseImageName + ":" + tag]);
        });
    }

    var includeLatestTag = tl.getBoolInput("includeLatestTag");
    if (baseImageName !== imageName && includeLatestTag) {
        command.arg(["-t", baseImageName]);
    }

    var memoryLimit = tl.getInput("memoryLimit");
    if (memoryLimit) {
        command.arg(["-m", memoryLimit]);
    }

    var context: string;
    var useDefaultContext = tl.getBoolInput("useDefaultContext");
    if (useDefaultContext) {
        context = path.dirname(dockerFile);
    } else {
        context = tl.getPathInput("buildContext");
    }
    command.arg(context);

    let output: string = "";
    command.on("stdout", data => {
        output += data;
    });

    return connection.execCommand(command).then(() => {
        let taskOutputPath = utils.writeTaskOutput("build", output);
        tl.setVariable("DockerOutputPath", taskOutputPath);

        const builtImageId = imageUtils.getImageIdFromBuildOutput(output);
        if (builtImageId) {
            imageUtils.shareBuiltImageId(builtImageId);
        }
    });
}

function GetImageAnnotation(connection: ContainerConnection, dockerFilePath: string): ImageAnnotations {
    let imageAnnotations: ImageAnnotations = {
        BaseImageName: "",
        BaseImageDigest: ""
    };

    imageAnnotations.BaseImageName = getBaseImageName(dockerFilePath);

    if (imageAnnotations.BaseImageName && imageAnnotations.BaseImageName != "") {
        imageAnnotations.BaseImageDigest = getImageDigest(connection, imageAnnotations.BaseImageName);
    }

    return imageAnnotations;
}


function getBaseImageName(dockerFilePath: string): string {
    // This method takes into consideration multi-stage dockerfiles, it tries to find the final
    // base image for the container.

    try {
        const dockerFileContent = fs.readFileSync(dockerFilePath, 'utf-8');

        if (!dockerFileContent || dockerFileContent == "") {
            return "";
        }

        var lines = dockerFileContent.split(/[\r?\n]/);
        var tagToImageNameMapping: Map<string, string> = new Map<string, string>();
        var baseImage = "";
        for (var i = 0; i < lines.length; i++) {
            var index = lines[i].toUpperCase().indexOf("FROM");
            if (index == -1) {
                continue;
            }

            var nameComponents = lines[i].substring(index + 4).toLowerCase().split(" as ");
            var prospectImageName = nameComponents[0].trim()
            if (nameComponents.length > 1) {
                var tag = nameComponents[1].trim()
                if (tagToImageNameMapping.has(prospectImageName)) {
                    tagToImageNameMapping.set(tag, tagToImageNameMapping.get(prospectImageName));
                } else {
                    tagToImageNameMapping.set(tag, prospectImageName);
                }
                baseImage = tagToImageNameMapping.get(tag);
            } else {
                baseImage = tagToImageNameMapping.has(prospectImageName)
                    ? tagToImageNameMapping.get(prospectImageName)
                    : prospectImageName
            }
        }
        return baseImage.includes("$") // In this case the base image has an argument and we don't know what it is its real value
            ? ""
            : baseImage
    } catch (error) {
        tl.debug(`An error was found getting the base image for the docker file ${dockerFilePath}. ${error.message}`);
        return "";
    }
}

function getImageDigest(connection: ContainerConnection, imageName: string,): string {
    try {
        pullImage(connection, imageName);
        let inspectObj = inspectImage(connection, imageName);

        if (!inspectObj) {
            return "";
        }

        let repoDigests: string[] = inspectObj.RepoDigests

        if (repoDigests.length == 0) {
            tl.debug(`No digests where found for image: ${imageName}`);
            return "";
        }

        if (repoDigests.length > 1) {
            tl.debug(`Multiple digests where found for image: ${imageName}`);
            return "";
        }

        return repoDigests[0].split("@")[1]
    } catch (error) {
        tl.debug(`An exception was thrown getting the image digest for ${imageName}, the error was ${error.message}`)
        return "";
    }
}

function pullImage(connection: ContainerConnection, imageName: string) {
    let pullCommand = connection.createCommand();
    pullCommand.arg("pull");
    pullCommand.arg([imageName]);
    let pullResult = pullCommand.execSync();

    if (pullResult.stderr && pullResult.stderr != "") {
        tl.debug(`An error was found pulling the image ${imageName}, the command output was ${pullResult.stderr}`);
    }
}

function inspectImage(connection: ContainerConnection, imageName): any {
    let inspectCommand = connection.createCommand();
    inspectCommand.arg("inspect");
    inspectCommand.arg([imageName]);
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

    return inspectObj[0]
}

function isBaseImageLabelAnnotationEnabled(): boolean {
    const controlVariable = tl.getVariable("addBaseImageData")
    if (!controlVariable) {
        return true;
    }

    return controlVariable.toLocaleLowerCase() !== 'false';
}