"use strict";

import * as tl from "vsts-task-lib/task";
import * as URL from 'url';
import * as util from "util";
import { ToolRunner } from "vsts-task-lib/toolrunner";

function addLabelArg(command: ToolRunner, hostName: string, labelName: string, variableName: string)
{  
    let labelValue = tl.getVariable(variableName);
    if (labelValue) {
        command.arg(["--label", util.format("%s.image.%s=%s", hostName, labelName, labelValue)]);
    }
}

function addCommonLabelArgs(command: ToolRunner, hostName: string): void {
    addLabelArg(command, hostName, "system.teamfoundationcollectionuri", "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI");
    addLabelArg(command, hostName, "system.teamproject", "SYSTEM_TEAMPROJECT");
    addLabelArg(command, hostName, "build.repository.name", "BUILD_REPOSITORY_NAME");
}

function addBuildLabelArgs(command: ToolRunner, hostName: string): void {
    addLabelArg(command, hostName, "build.repository.uri", "BUILD_REPOSITORY_URI");
    addLabelArg(command, hostName, "build.sourcebranchname", "BUILD_SOURCEBRANCHNAME");
    addLabelArg(command, hostName, "build.sourceversion", "BUILD_SOURCEVERSION");
    addLabelArg(command, hostName, "build.definitionname", "BUILD_DEFINITIONNAME");
    addLabelArg(command, hostName, "build.buildnumber", "BUILD_BUILDNUMBER");
    addLabelArg(command, hostName, "build.builduri", "BUILD_BUILDURI");
    addLabelArg(command, hostName, "build.requestedfor", "BUILD_REQUESTEDFOR");
}

function addReleaseLabelArgs(command: ToolRunner, hostName: string): void {    
    addLabelArg(command, hostName, "release.definitionname", "RELEASE_DEFINITIONNAME");
    addLabelArg(command, hostName, "release.releaseid", "RELEASE_RELEASEID");
    addLabelArg(command, hostName, "release.releaseweburl", "RELEASE_RELEASEWEBURL");
    addLabelArg(command, hostName, "release.deployment.requestedfor", "RELEASE_DEPLOYMENT_REQUESTEDFOR");
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

export function addDefaultLabels(command: ToolRunner): void {
    let hostName = getReverseDNSName();
    if (hostName) {
        addCommonLabelArgs(command, hostName);
        let hostType = tl.getVariable("SYSTEM_HOSTTYPE");
        if (hostType.toLowerCase() === "build") {
            addBuildLabelArgs(command, hostName);
        }
        else {
            addReleaseLabelArgs(command, hostName);
        }
    }
}