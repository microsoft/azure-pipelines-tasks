"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as dockerCommandUtils from "docker-common/dockercommandutils";
import * as fileUtils from "docker-common/fileutils";
import * as pipelineUtils from "docker-common/pipelineutils";
import * as utils from "./utils";

function useDefaultBuildContext(buildContext: string): boolean {
    let defaultWorkingDir = tl.getVariable("SYSTEM_DEFAULTWORKINGDIRECTORY");
    let defaultPath = path.join(defaultWorkingDir, "**");
    return buildContext === defaultPath;
}

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

    // get label arguments
    let labelArguments = pipelineUtils.getDefaultLabels();

    // get tags input
    let tags = tl.getDelimitedInput("tags", "\n");
    let tagArguments: string[] = [];
    // find all the tag arguments to be added to the command
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    tagArguments.push(imageName + ":" + tag);
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

    // get build context
    let buildContext = tl.getPathInput("buildContext");
    if (useDefaultBuildContext(buildContext)) {
        buildContext = path.dirname(dockerFile);
    }

    let output = "";
    return dockerCommandUtils.build(connection, dockerFile, buildContext, commandArguments, labelArguments, tagArguments, (data) => output += data).then(() => {
        let taskOutputPath = utils.writeTaskOutput("build", output);
        outputUpdate(taskOutputPath);
    });
}
