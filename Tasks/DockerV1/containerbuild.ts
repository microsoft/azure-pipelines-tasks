"use strict";

import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import * as fileUtils from "azure-pipelines-tasks-docker-common-v2/fileutils";
import * as pipelineUtils from "azure-pipelines-tasks-docker-common-v2/pipelineutils";
import ContainerConnection from "azure-pipelines-tasks-docker-common-v2/containerconnection";
import * as sourceUtils from "azure-pipelines-tasks-docker-common-v2/sourceutils";
import * as imageUtils from "azure-pipelines-tasks-docker-common-v2/containerimageutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.arg("build");

    var dockerfilepath = tl.getInput("dockerFile", true);
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);
    
    if(!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
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
    });
}
