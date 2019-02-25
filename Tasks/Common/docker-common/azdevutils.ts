"use strict";

import * as tl from "vsts-task-lib/task";
import * as URL from 'url';
import * as util from "util";
import { ToolRunner } from "vsts-task-lib/toolrunner";

function addLabel(command: ToolRunner, hostName: string, labelName: string, variableName: string)
{  
    let labelValue = tl.getVariable(variableName);
    if (labelValue) {
        command.arg(["--label", util.format("%s.image.%s=%s", hostName, labelName, labelValue)]);
    }
}

export function addCommonLabels(command: ToolRunner, hostName: string): void {
    addLabel(command, hostName, "system.teamfoundationcollectionuri", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI");
    addLabel(command, hostName, "system.teamproject", "SYSTEM_TEAMPROJECT");
    addLabel(command, hostName, "build.repository.name", "BUILD_REPOSITORY_NAME");
}

export function addBuildLabels(command: ToolRunner, hostName: string): void {
    addLabel(command, hostName, "build.repository.uri", "BUILD_REPOSITORY_URI");
    addLabel(command, hostName, "build.sourcebranchname", "BUILD_SOURCEBRANCHNAME");
    addLabel(command, hostName, "build.sourceversion", "BUILD_SOURCEVERSION");
    addLabel(command, hostName, "build.definitionname", "BUILD_DEFINITIONNAME");
    addLabel(command, hostName, "build.buildnumber", "BUILD_BUILDNUMBER");
    addLabel(command, hostName, "build.builduri", "BUILD_BUILDURI");
    addLabel(command, hostName, "build.requestedfor", "BUILD_REQUESTEDFOR");
}

export function addReleaseLabels(command: ToolRunner, hostName: string): void {    
    addLabel(command, hostName, "release.definitionname", "RELEASE_DEFINITIONNAME");
    addLabel(command, hostName, "release.releaseid", "RELEASE_RELEASEID");
    addLabel(command, hostName, "release.releaseweburl", "RELEASE_RELEASEWEBURL");
    addLabel(command, hostName, "release.deployment.requestedfor", "RELEASE_DEPLOYMENT_REQUESTEDFOR");
}

export function getReverseDNSName(): string {
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

export function addDefaultLabels(command: ToolRunner): void {
    let hostName = getReverseDNSName();
    if (hostName) {
        addCommonLabels(command, hostName);
        let hostType = tl.getVariable("SYSTEM_HOSTTYPE");
        if (hostType.toLowerCase() === "build") {
            addBuildLabels(command, hostName);
        }
        else {
            addReleaseLabels(command, hostName);
        }
    }
}