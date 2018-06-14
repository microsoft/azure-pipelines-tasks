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

function addCommonLabels(command: ToolRunner, hostName: string): void {
    command.arg(["--label", util.format("%s.image.system.teamfoundationcollectionuri=%s", hostName, tl.getVariable("SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"))]);
    command.arg(["--label", util.format("%s.image.system.teamproject=%s", hostName, tl.getVariable("SYSTEM_TEAMPROJECT"))]);
    var repoName = tl.getVariable("BUILD_REPOSITORY_NAME");
    if (repoName) {
        command.arg(["--label", util.format("%s.image.build.repository.name=%s", hostName, repoName)]);
    }
}

function addBuildLabels(command: ToolRunner, hostName: string): void {
    var repoUri = tl.getVariable("BUILD_REPOSITORY_URI");
    if (repoUri) {
        command.arg(["--label", util.format("%s.image.build.repository.uri=%s", hostName, repoUri)]);
    }
    var branchName = tl.getVariable("BUILD_SOURCEBRANCHNAME");
    if (branchName) {
        command.arg(["--label", util.format("%s.image.build.sourcebranchname=%s", hostName, branchName)]);
    }
    var sourceVersion = tl.getVariable("BUILD_SOURCEVERSION");
    if (sourceVersion) {
        command.arg(["--label", util.format("%s.image.build.sourceversion=%s", hostName, sourceVersion)]);
    }

    command.arg(["--label", util.format("%s.image.build.definitionname=%s", hostName, tl.getVariable("BUILD_DEFINITIONNAME"))]);
    command.arg(["--label", util.format("%s.image.build.buildnumber=%s", hostName, tl.getVariable("BUILD_BUILDNUMBER"))]);
    command.arg(["--label", util.format("%s.image.build.builduri=%s", hostName, tl.getVariable("BUILD_BUILDURI"))]);
    command.arg(["--label", util.format("%s.image.build.requestedfor=%s", hostName, tl.getVariable("BUILD_REQUESTEDFOR"))]);
}

function addReleaseLabels(command: ToolRunner, hostName: string): void {
    
    command.arg(["--label", util.format("%s.image.release.definitionname=%s", hostName, tl.getVariable("RELEASE_DEFINITIONNAME"))]);
    command.arg(["--label", util.format("%s.image.release.releaseid=%s", hostName, tl.getVariable("RELEASE_RELEASEID"))]);
    command.arg(["--label", util.format("%s.image.release.releaseweburl=%s", hostName, tl.getVariable("RELEASE_RELEASEWEBURL"))]);
    command.arg(["--label", util.format("%s.image.release.deployment.requestedfor=%s", hostName, tl.getVariable("RELEASE_DEPLOYMENT_REQUESTEDFOR"))]);
}

function getReverseDNSName(): string {
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
            var hostType = tl.getVariable("SYSTEM_HOSTTYPE");
            addCommonLabels(command, hostName);
            if (hostType === "build") {            
                addBuildLabels(command, hostName);
            }
            else if (hostType === "release") {
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
