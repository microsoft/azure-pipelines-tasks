"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require("fs");
import * as utils from "./../utilities";
import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import { Kubectl, Resource } from "utility-common/kubectl-object-model";

export async function deploy() {

    var files: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), tl.getInput("manifests", true));

    if (files.length == 0) {
        throw (tl.loc("ManifestFileNotFound"));
    }

    let containers = tl.getDelimitedInput("containers", "\n");
    files = updateContainerImagesInConfigFiles(files, containers);

    let kubectl = new Kubectl(await utils.getKubectl(), tl.getInput("namespace", false));

    let result = kubectl.apply(files);
    utils.checkForErrors([result]);

    let rolloutStatusResults = [];

    let resourceTypes: Resource[] = kubectl.getResources(result.stdout, recognizedWorkloadTypes);
    resourceTypes.forEach(resource => {
        rolloutStatusResults.push(kubectl.checkRolloutStatus(resource.type, resource.name));
    });
    utils.checkForErrors(rolloutStatusResults);

    let annotateResults: IExecSyncResult[] = [];
    var allPods = JSON.parse((kubectl.getAllPods()).stdout);
    annotateResults.push(kubectl.annotateFiles(files, utils.annotationsToAdd(), true));
    resourceTypes.forEach(resource => {
        if (resource.type.indexOf("pods") == -1)
            utils.annotateChildPods(kubectl, resource.type, resource.name, allPods)
                .forEach(execResult => annotateResults.push(execResult));
    });
    utils.checkForErrors(annotateResults, true);
}

function updateContainerImagesInConfigFiles(filePaths: string[], containers): string[] {
    if (containers != []) {
        let newFilePaths = [];
        const tempDirectory = utils.getTempDirectory();
        filePaths.forEach((filePath: string) => {
            var contents = fs.readFileSync(filePath).toString();
            containers.forEach((container: string) => {
                let imageName = container.split(":")[0] + ":";
                if (contents.indexOf(imageName) > 0) {
                    contents = replaceAllTokens(contents, imageName, container);
                }
            });

            let fileName = path.join(tempDirectory, path.basename(filePath));
            fs.writeFileSync(
                path.join(fileName),
                contents
            );

            newFilePaths.push(fileName);
        });

        return newFilePaths;
    }

    return filePaths;
}

function replaceAllTokens(currentString: string, replaceToken, replaceValue) {
    let i = currentString.indexOf(replaceToken);
    if (i < 0) {
        tl.debug(`No occurence of replacement token: ${replaceToken} found`);
        return currentString;
    }

    let newString = currentString.substring(0, i);
    let leftOverString = currentString.substring(i);
    newString += replaceValue + leftOverString.substring(Math.min(leftOverString.indexOf("\n"), leftOverString.indexOf("\"")));
    if (newString == currentString) {
        tl.debug(`All occurences replaced`);
        return newString;
    }
    return replaceAllTokens(newString, replaceToken, replaceValue);
}

var recognizedWorkloadTypes = ["deployment", "replicaset", "daemonset", "pod", "statefulset"];