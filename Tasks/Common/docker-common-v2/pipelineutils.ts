"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as URL from 'url';
import * as util from "util";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";

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

function addCommonLabels(hostName: string, labels: string[]): void {
    addLabel(hostName, "system.teamfoundationcollectionuri", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI", labels);
    addLabel(hostName, "system.teamproject", "SYSTEM_TEAMPROJECT", labels);
    addLabel(hostName, "build.repository.name", "BUILD_REPOSITORY_NAME", labels);
}

function addBuildLabels(hostName: string, labels: string[]): void {
    addLabel(hostName, "build.repository.uri", "BUILD_REPOSITORY_URI", labels);
    addLabel(hostName, "build.sourcebranchname", "BUILD_SOURCEBRANCHNAME", labels);
    addLabel(hostName, "build.sourceversion", "BUILD_SOURCEVERSION", labels);
    addLabel(hostName, "build.definitionname", "BUILD_DEFINITIONNAME", labels);
    addLabel(hostName, "build.buildnumber", "BUILD_BUILDNUMBER", labels);
    addLabel(hostName, "build.builduri", "BUILD_BUILDURI", labels);
}

function addReleaseLabels(hostName: string, labels: string[]): void {    
    addLabel(hostName, "release.definitionname", "RELEASE_DEFINITIONNAME", labels);
    addLabel(hostName, "release.releaseid", "RELEASE_RELEASEID", labels);
    addLabel(hostName, "release.releaseweburl", "RELEASE_RELEASEWEBURL", labels);
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

export function getDefaultLabels(): string[] {
    let labels: string[] = [];
    let hostName = getReverseDNSName();
    if (hostName) {
        addCommonLabels(hostName, labels);
        let hostType = tl.getVariable("SYSTEM_HOSTTYPE");
        if (hostType.toLowerCase() === "build") {
            addBuildLabels(hostName, labels);
        }
        else {
            addReleaseLabels(hostName, labels);
        }
    }

    return labels;
}