"use strict";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as pipelineUtils from "azure-pipelines-tasks-docker-common/pipelineutils";
import * as fileUtils from "azure-pipelines-tasks-docker-common/fileutils";
import * as sourceUtils from "azure-pipelines-tasks-docker-common/sourceutils";
import * as imageUtils from "azure-pipelines-tasks-docker-common/containerimageutils";
import * as utils from "./utils";

export function run(connection: ContainerConnection): any {
    var command = connection.createCommand();
    command.arg("build");

    var dockerfilepath = tl.getInput("dockerFile", true);
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);

    if (!tl.exist(dockerFile)) {
        throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
    }

    command.arg(["-f", dockerFile]);

    tl.getDelimitedInput("buildArguments", "\n").forEach(buildArgument => {
        command.arg(["--build-arg", buildArgument]);
    });

    var imageName = utils.getImageName();
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.getQualifiedImageNameIfRequired(imageName);
    }
    command.arg(["-t", tl.getBoolInput("enforceDockerNamingConvention") ? imageUtils.generateValidImageName(imageName) : imageName]);

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

    var memory = tl.getInput("memory");
    if (memory) {
        command.arg(["-m", memory]);
    }

    const addBaseImageInfo = tl.getBoolInput("addBaseImageData");
    const labelsArgument = pipelineUtils.getDefaultLabels(false, addBaseImageInfo, dockerFile, connection);

    labelsArgument.forEach(label => {
        command.arg(["--label", label]);
    });

    var context: string;
    var defaultContext = tl.getBoolInput("defaultContext");
    if (defaultContext) {
        context = path.dirname(dockerFile);
    } else {
        context = tl.getPathInput("context");
    }

    command.arg(context);

    let output: string = "";
    command.on("stdout", data => {
        output += data;
    });

    let err: string = "";
    command.on("stderr", data =>{
        err += data;
    });

    return connection.execCommand(command).then(() => {
        if (isBuildKitEnabled())
        {
            // Build kit output the build results to stderr instead of stdout
            // https://github.com/moby/moby/issues/40031
            output = err;
        }

        let taskOutputPath = utils.writeTaskOutput("build", output);
        tl.setVariable("DockerOutputPath", taskOutputPath);

        const builtImageId = imageUtils.getImageIdFromBuildOutput(output);
        if (builtImageId) {
            imageUtils.shareBuiltImageId(builtImageId);
        }
    });
}

function isBuildKitEnabled(): boolean {
    // https://docs.docker.com/develop/develop-images/build_enhancements/
    const isBuildKitBuildValue = tl.getVariable("DOCKER_BUILDKIT");
    return isBuildKitBuildValue && Number(isBuildKitBuildValue) == 1;
}
