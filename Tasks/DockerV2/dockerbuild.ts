"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as azdevUtils from "docker-common/azdevutils";
import ContainerConnection from "docker-common/containerconnection";
import * as utils from "./utils";

function findDockerFile(dockerfilepath : string) : string {
    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        let buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
        let allFiles = tl.find(buildFolder);
        let matchingResultsFiles = tl.match(allFiles, dockerfilepath, buildFolder, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
        }

        return matchingResultsFiles[0];
    }
    else
    {
        tl.debug(tl.loc('ContainerPatternNotFound'));
        return dockerfilepath;
    }
}

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any): any {
    let command = connection.createCommand();

    // setup variable to store the command output
    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    command.arg("build");

    // add dockerfile path
    let dockerfilepath = tl.getInput("dockerFile", true);
    let dockerFile = findDockerFile(dockerfilepath);
    
    if(!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
    }

    command.arg(["-f", dockerFile]);

    // add default labels
    azdevUtils.addDefaultLabels(command);

    // add command arguments
    let commandArguments = tl.getInput("arguments", false); 
    command.line(commandArguments);
    
    // get qualified image name from the containerRegistry input
    let repositoryName = tl.getInput("repository");
    let imageNames: string[] = [];
    
    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName);
    }

    // get tags input
    let tags = tl.getDelimitedInput("tags", "\n");

    // add all the tags to the command
    if (imageNames && imageNames.length > 0) {
        imageNames.forEach(imageName => {
            if (tags && tags.length > 0) {
                tags.forEach(tag => {
                    command.arg(["-t", imageName + ":" + tag]);
                });
            }
            else {
                command.arg(["-t", imageName]);
            }
        });
    }

    // add build context
    let context: string;
    let buildContext = tl.getPathInput("buildContext");
    if (!buildContext) {
        context = path.dirname(dockerFile);
    } else {
        context = buildContext;
    }

    command.arg(context);
    return connection.execCommand(command).then(() => {
        let taskOutputPath = utils.writeTaskOutput("build", output);
        outputUpdate(taskOutputPath);
    });
}
