"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common-v2/containerconnection";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import * as fileUtils from "azure-pipelines-tasks-docker-common-v2/fileutils";
import * as pipelineUtils from "azure-pipelines-tasks-docker-common-v2/pipelineutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): any {
    // find dockerfile path
    let dockerfilepath = tl.getInput("Dockerfile", true);
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);
    
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

    // get tags input
    let tagsInput = tl.getInput("tags");
    let tags = tagsInput ? tagsInput.split(/[\n,]+/) : [];

    let tagArguments: string[] = [];
    // find all the tag arguments to be added to the command
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    if(tag)
                    {
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

        const builtImageId = getBuiltImageIdFromDockerBuiltOutput(output);
        if (builtImageId && builtImageId != ""){
            shareBuiltImageId(builtImageId);
        }
    });
}

function shareBuiltImageId(builtImageId: string) {
    let builtImages: string = tl.getVariable("DOCKER_TASK_BUILT_IMAGES");
    const IMAGE_SEPARATOR_CHAR:string = ";";

    if (builtImages && builtImages != ""){
        builtImages += `${IMAGE_SEPARATOR_CHAR}${builtImages}`;
    }
    else {
        builtImages = builtImageId;
    }

    tl.setVariable("DOCKER_TASK_BUILT_IMAGES", builtImages);
}

function getBuiltImageIdFromDockerBuiltOutput(output: string) : string {
    const standardParser = (text:string): string => {
        let parsedOutput: string[] = text.match(new RegExp("Successfully built ([0-9a-f]{12})",'g'));

        return !parsedOutput || parsedOutput.length == 0
            ? ""
            : parsedOutput[parsedOutput.length-1].substring(19); // This remove the Succesfully built section
    };

    const buildKitParser = (text: string): string => {
        let parsedOutput : string[] = text.match(new RegExp("Writing image sha256:([0-9a-f]{64}): done",'g'));

        return !parsedOutput || parsedOutput.length == 0
            ? ""
            : parsedOutput[parsedOutput.length].substring(21,33); // This remove the section Writing Image Sha256 and takes 12 characters from the Id.
    }

    let buildOutputParserFuncs = [standardParser, buildKitParser]
    for(let parserFunc of buildOutputParserFuncs){
        const builtImageId = parserFunc(output);
        if (builtImageId && builtImageId != ""){
            return builtImageId;
        }
    }
    return "";
 }