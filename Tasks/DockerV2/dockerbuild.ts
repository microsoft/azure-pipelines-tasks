"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common-v2/containerconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import * as fileUtils from "azure-pipelines-tasks-docker-common-v2/fileutils";
import * as pipelineUtils from "azure-pipelines-tasks-docker-common-v2/pipelineutils";
import * as containerImageUtils from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
import * as utils from "./utils";

interface ImageAnnotations{
    BaseImageName :string,
    BaseImageDigest: string
}

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): any {
    // find dockerfile path
    let dockerfilepath = tl.getInput("Dockerfile", true);
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);
    let imageAnnotations: ImageAnnotations = null;

    if(isBaseImageLabelAnnotationEnabled()){
        imageAnnotations = GetImageAnnotation(connection, dockerFile);
    }

    if(!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
    }

    // get command arguments
    // ignore the arguments input if the command is buildAndPush, as it is ambiguous
    let commandArguments = isBuildAndPushCommand ? "" : dockerCommandUtils.getCommandArguments(tl.getInput("arguments", false));

    // get qualified image names by combining container registry(s) and repository
    let repositoryName = tl.getInput("repository");
    let imageNames: string[] = [];
    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName, true);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName, true);
    }

    const addPipelineData = tl.getBoolInput("addPipelineData");
    // get label arguments
    let labelArguments = pipelineUtils.getDefaultLabels(addPipelineData);

    if(imageAnnotations && imageAnnotations.BaseImageName!= "") {
        labelArguments.push(`image.base.ref.name=${imageAnnotations.BaseImageName}`)
    }

    if(imageAnnotations && imageAnnotations.BaseImageDigest != "") {
        labelArguments.push(`image.base.digest=${imageAnnotations.BaseImageDigest}`)
    }

    // get tags input
    let tagsInput = tl.getInput("tags");
    let tags = tagsInput ? tagsInput.split(/[\n,]+/) : [];

    let tagArguments: string[] = [];
    // find all the tag arguments to be added to the command
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    if (tag) {
                        tagArguments.push(imageName + ":" + tag);
                    }
                });
            }
            else {
                // pass just the imageName and not the tag. This will tag the image with latest tag as per the default behavior of the build command.
                tagArguments.push(imageName);
            }
        });
    }
    else {
        tl.debug(tl.loc('NotAddingAnyTagsToBuild'));
    }

    let output = "";
    return dockerCommandUtils.build(connection, dockerFile, commandArguments, labelArguments, tagArguments, (data) => output += data).then(() => {
        let taskOutputPath = utils.writeTaskOutput("build", output);
        outputUpdate(taskOutputPath);

        const builtImageId = containerImageUtils.getImageIdFromBuildOutput(output);
        if (builtImageId) {
            containerImageUtils.shareBuiltImageId(builtImageId);
        }
    });
}

function getImageDigest(connection: ContainerConnection, imageName: string, ): string {
    // test for multi-stages the "as" part could have problems
    try {
        pullImage(connection, imageName);
        let inspectObj = inspectImage(connection, imageName);

        if(!inspectObj){
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

function pullImage(connection: ContainerConnection, imageName: string){
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
   if (!controlVariable){
       return true;
   }

   return controlVariable.toLocaleLowerCase() !== 'false';
}
