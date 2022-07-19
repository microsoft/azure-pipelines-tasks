"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as URL from 'url';
import * as util from "util";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import ContainerConnection from "./containerconnection";
import * as containerUtils from "./containerimageutils";

function addLabelArgs(command: ToolRunner, labels: string[]) {
    labels.forEach(label => {
        command.arg(["--label", label]);
    });
}

function addLabel(hostName: string, labelName: string, variableName: string, labels: string[]): void {
    let labelValue = tl.getVariable(variableName);
    if (labelValue) {
        let label = util.format("%s.image.%s=%s", hostName, labelName, labelValue);
        labels.push(label);
    }
}

function addLabelWithValue(labelName: string, labelValue: string, labels: string[]): void {
    let label = util.format("%s=%s", labelName, labelValue);
    labels.push(label);
}

function addCommonLabels(hostName: string, labels: string[], addPipelineData?: boolean): void {
    if (addPipelineData) {
        addLabel(hostName, "system.teamfoundationcollectionuri", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI", labels);
        addLabel(hostName, "system.teamproject", "SYSTEM_TEAMPROJECT", labels);
        addLabel(hostName, "build.repository.name", "BUILD_REPOSITORY_NAME", labels);
    }
}

function addBuildLabels(hostName: string, labels: string[], addPipelineData?: boolean): void {
    if (addPipelineData) {
        addLabel(hostName, "build.sourceversion", "BUILD_SOURCEVERSION", labels);
        addLabel(hostName, "build.repository.uri", "BUILD_REPOSITORY_URI", labels);
        addLabel(hostName, "build.sourcebranchname", "BUILD_SOURCEBRANCHNAME", labels);
        addLabel(hostName, "build.definitionname", "BUILD_DEFINITIONNAME", labels);
        addLabel(hostName, "build.buildnumber", "BUILD_BUILDNUMBER", labels);
        addLabel(hostName, "build.builduri", "BUILD_BUILDURI", labels);
    }
}

function addReleaseLabels(hostName: string, labels: string[], addPipelineData?: boolean): void {
    addLabel(hostName, "release.releaseid", "RELEASE_RELEASEID", labels);
    if (addPipelineData) {
        addLabel(hostName, "release.definitionname", "RELEASE_DEFINITIONNAME", labels);
        addLabel(hostName, "release.releaseweburl", "RELEASE_RELEASEWEBURL", labels);
    }
}

function addBaseImageLabels(connection: ContainerConnection, labels: string[], dockerFilePath: string): void {
    const baseImageName = containerUtils.getBaseImageNameFromDockerFile(dockerFilePath);
    if (!baseImageName) {
        return;
    }

    addLabelWithValue("image.base.ref.name", baseImageName, labels);

    if (!connection) {
        tl.debug("Image digest couldn't be extracted because no connection was found.");
        return;
    }

    const baseImageDigest = containerUtils.getImageDigest(connection, baseImageName);
    if (baseImageDigest) {
        addLabelWithValue("image.base.digest", baseImageDigest, labels);
    }
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

export function addDefaultLabelArgs(command: ToolRunner): void {
    let labels = getDefaultLabels();
    addLabelArgs(command, labels);
}

export function getDefaultLabels(addPipelineData?: boolean, addBaseImageData?: boolean, dockerFilePath?: string, connection?: ContainerConnection): string[] {
    let labels: string[] = [];
    let hostName = getReverseDNSName();
    if (hostName) {
        addCommonLabels(hostName, labels, addPipelineData);
        let hostType = tl.getVariable("SYSTEM_HOSTTYPE");
        if (hostType.toLowerCase() === "build") {
            addBuildLabels(hostName, labels, addPipelineData);
        }
        else {
            addReleaseLabels(hostName, labels, addPipelineData);
        }
    }

    if (addBaseImageData) {
        try {
            addBaseImageLabels(connection, labels, dockerFilePath)
        } catch (error) {
            tl.debug(`An error ocurred getting the base image lables ${error.message}`);
        }
    }
    return labels;
}