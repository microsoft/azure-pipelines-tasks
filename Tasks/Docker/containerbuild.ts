"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "./containerconnection";
import * as sourceUtils from "./sourceutils";
import * as imageUtils from "./containerimageutils";

function findDockerFile(dockerfilepath : string) : string {

    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        var buildFolder = tl.cwd();
        var allFiles = tl.find(buildFolder);
        var matchingResultsFiles = tl.match(allFiles, dockerfilepath, buildFolder, { matchBase: true });

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

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.arg("build");

    var dockerfilepath = tl.getInput("dockerFile", true);
    var dockerFile = findDockerFile(dockerfilepath);
    
    if(!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
    }

    command.arg(["-f", dockerFile]);

    tl.getDelimitedInput("buildArguments", "\n").forEach(buildArgument => {
        command.arg(["--build-arg", buildArgument]);
    });

    var imageName = tl.getInput("imageName", true);
    imageName = imageUtils.changeDefaultImageNameToLowerCase(imageName);
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.qualifyImageName(imageName);
    }
    command.arg(["-t", imageName]);

    var baseImageName = imageUtils.imageNameWithoutTag(imageName);

    tl.getDelimitedInput("additionalImageTags", "\n").forEach(tag => {
        command.arg(["-t", baseImageName + ":" + tag]);
    });

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

    var context: string;
    var defaultContext = tl.getBoolInput("defaultContext");
    if (defaultContext) {
        context = path.dirname(dockerFile);
    } else {
        context = tl.getPathInput("context");
    }
    command.arg(context);
    return connection.execCommand(command);
}
