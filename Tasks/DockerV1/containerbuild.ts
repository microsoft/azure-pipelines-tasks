"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as sourceUtils from "docker-common/sourceutils";
import * as imageUtils from "docker-common/containerimageutils";
import * as utils from "./utils";
import { ToolRunner } from "vsts-task-lib/toolrunner";

function findDockerFile(dockerfilepath : string) : string {

    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        var buildFolder = tl.getVariable('System.DefaultWorkingDirectory');
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

function addCommonLabels(command: ToolRunner): void {
    command.arg(["--label", "com.visualstudio.image.system.teamfoundationcollectionuri=" + tl.getVariable("SYSTEM_TEAMFOUNDATIONCOLLECTIONURI")]);
    command.arg(["--label", "com.visualstudio.image.system.teamproject=" + tl.getVariable("SYSTEM_TEAMPROJECT")]);
    var repoName = tl.getVariable("BUILD_REPOSITORY_NAME");
    if (repoName) {
        command.arg(["--label", "com.visualstudio.image.build.repository.name=" + repoName]);
    }
}

function addBuildLabels(command: ToolRunner): void {
    var repoUri = tl.getVariable("BUILD_REPOSITORY_URI");
    if (repoUri) {
        command.arg(["--label", "com.visualstudio.image.build.repository.uri=" + repoUri]);
    }
    var branchName = tl.getVariable("BUILD_SOURCEBRANCHNAME");
    if (branchName) {
        command.arg(["--label", "com.visualstudio.image.build.sourcebranchname=" + branchName]);
    }
    var sourceVersion = tl.getVariable("BUILD_SOURCEVERSION");
    if (sourceVersion) {
        command.arg(["--label", "com.visualstudio.image.build.sourceversion=" + sourceVersion]);
    }
    command.arg(["--label", "com.visualstudio.image.build.definitionname=" + tl.getVariable("BUILD_DEFINITIONNAME")]);
    command.arg(["--label", "com.visualstudio.image.build.buildnumber=" + tl.getVariable("BUILD_BUILDNUMBER")]);
    command.arg(["--label", "com.visualstudio.image.build.builduri=" + tl.getVariable("BUILD_BUILDURI")]);
    command.arg(["--label", "com.visualstudio.image.build.requestedfor=" + tl.getVariable("BUILD_REQUESTEDFOR")]);
}

function addReleaseLabels(command: ToolRunner): void {
    command.arg(["--label", "com.visualstudio.image.release.definitionname=" + tl.getVariable("RELEASE_DEFINITIONNAME")]);
    command.arg(["--label", "com.visualstudio.image.release.releaseid=" + tl.getVariable("RELEASE_RELEASEID")]);
    command.arg(["--label", "com.visualstudio.image.release.releaseweburl=" + tl.getVariable("RELEASE_RELEASEWEBURL")]);
    command.arg(["--label", "com.visualstudio.image.release.deployment.requestedfor=" + tl.getVariable("RELEASE_DEPLOYMENT_REQUESTEDFOR")]);
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

    var addDefaultLabels = tl.getBoolInput("addDefaultLabels");
    if (addDefaultLabels) {
        var hostType = tl.getVariable("SYSTEM_HOSTTYPE");
        addCommonLabels(command);
        if (hostType === "build") {            
            addBuildLabels(command);
        }
        else if (hostType === "release") {
            addReleaseLabels(command);
        }
    }

    var commandArguments = tl.getInput("arguments", false); 
    command.line(commandArguments);
    
    var imageName = utils.getImageName(); 
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.qualifyImageName(imageName);
    }
    command.arg(["-t", imageName]);

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
    return connection.execCommand(command);
}
