"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as sourceUtils from "docker-common/sourceutils";
import * as imageUtils from "docker-common/containerimageutils";
import * as URL from 'url';
import * as utils from "./utils";
import * as util from "util";
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

function addLabel(command: ToolRunner, hostName: string, labelName: string, variableName: string)
{  
    var labelValue = tl.getVariable(variableName);
    if (labelValue) {
        command.arg(["--label", util.format("%s.image.%s=%s", hostName, labelName, labelValue)]);
    }
}

function addCommonLabels(command: ToolRunner, hostName: string): void {
    addLabel(command, hostName, "system.teamfoundationcollectionuri", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI");
    addLabel(command, hostName, "system.teamproject", "SYSTEM_TEAMPROJECT");
    addLabel(command, hostName, "build.repository.name", "BUILD_REPOSITORY_NAME");
}

function addBuildLabels(command: ToolRunner, hostName: string): void {
    addLabel(command, hostName, "build.repository.uri", "BUILD_REPOSITORY_URI");
    addLabel(command, hostName, "build.sourcebranchname", "BUILD_SOURCEBRANCHNAME");
    addLabel(command, hostName, "build.sourceversion", "BUILD_SOURCEVERSION");
    addLabel(command, hostName, "build.definitionname", "BUILD_DEFINITIONNAME");
    addLabel(command, hostName, "build.buildnumber", "BUILD_BUILDNUMBER");
    addLabel(command, hostName, "build.builduri", "BUILD_BUILDURI");
    addLabel(command, hostName, "build.requestedfor", "BUILD_REQUESTEDFOR");
}

function addReleaseLabels(command: ToolRunner, hostName: string): void {    
    addLabel(command, hostName, "release.definitionname", "RELEASE_DEFINITIONNAME");
    addLabel(command, hostName, "release.releaseid", "RELEASE_RELEASEID");
    addLabel(command, hostName, "release.releaseweburl", "RELEASE_RELEASEWEBURL");
    addLabel(command, hostName, "release.deployment.requestedfor", "RELEASE_DEPLOYMENT_REQUESTEDFOR");
}

function getReverseDNSName(): string {
    // Hostname part of URL used as prefix for labels.
    // it is safe to use url.parse on SYSTEM_TEAMFOUNDATIONCOLLECTIONURI here.
    var teamFoundationCollectionURI = tl.getVariable("SYSTEM_TEAMFOUNDATIONCOLLECTIONURI");
    if (teamFoundationCollectionURI) {
        var parsedUrl = URL.parse(teamFoundationCollectionURI);
        if (parsedUrl) {
            var hostName = parsedUrl.hostname.split(".").reverse().join(".");
            tl.debug(`Reverse DNS name ${hostName}`);
            return hostName;
        }
    }

    return null;
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
        var hostName = getReverseDNSName();
        if (hostName) {
            addCommonLabels(command, hostName);
            var hostType = tl.getVariable("SYSTEM_HOSTTYPE");
            if (hostType.toLowerCase() === "build") {
                addBuildLabels(command, hostName);
            }
            else {
                addReleaseLabels(command, hostName);
            }
        }
    }

    var commandArguments = tl.getInput("arguments", false); 
    command.line(commandArguments);
    
    var imageName = utils.getImageName(); 
    var qualifyImageName = tl.getBoolInput("qualifyImageName");
    if (qualifyImageName) {
        imageName = connection.qualifyImageName(imageName);
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
    return connection.execCommand(command);
}
